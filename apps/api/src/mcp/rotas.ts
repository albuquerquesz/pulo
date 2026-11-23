import { oauthProviderAuthServerMetadata, oauthProviderOpenIdConfigMetadata } from '@better-auth/oauth-provider';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/cfworker';
import { readUserMetadata } from '@pulo/core/domain/user-metadata';
import type { Db } from '@pulo/db';
import { verifyBearerToken } from 'better-auth/oauth2';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Auth } from '../auth';
import type { SessionUser } from '../http';
import { AUTH_BASE_PATH, MCP_PATH, MCP_SCOPES, type McpConfig } from '../mcp-config';
import { registrarFerramentas } from './ferramentas';
import { clienteInterno, repositorioInterno } from './repositorio';

export interface McpDeps {
  auth: Auth;
  db: Db;
  config: McpConfig;
  now: () => number;
  /** Chama a própria API como a pessoa do token (id verificado; ver `requireSession`). */
  chamarComo: (userId: string, request: Request) => Promise<Response>;
}

const VERSAO = '1.0.0';

/** 401 com o desafio da RFC 9728: o cliente MCP acha o servidor de autorização a partir daqui. */
function naoAutorizado(config: McpConfig, erro?: 'invalid_token'): Response {
  const partes = [`resource_metadata="${config.resourceMetadataUrl}"`, ...(erro ? [`error="${erro}"`] : [])];
  return Response.json(
    { jsonrpc: '2.0', error: { code: -32001, message: 'Entre na sua conta do Pulo para usar o MCP.' }, id: null },
    { status: 401, headers: { 'WWW-Authenticate': `Bearer ${partes.join(', ')}` } },
  );
}

/** A pessoa como a sessão a teria, lida de novo a cada chamada (o perfil muda no meio de uma ferramenta, como no onboarding). */
export async function lerPessoa(db: Db, id: string): Promise<SessionUser | null> {
  const row = await db.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, image: true, metadata: true } });
  return row && { id: row.id, name: row.name, email: row.email, image: row.image, metadata: readUserMetadata(row.metadata) };
}

/** Lê o `sub` de um access token do nosso servidor OAuth, com `aud` = o recurso `/mcp`. */
async function pessoaDoToken(deps: McpDeps, autorizacao: string | undefined): Promise<string | 'sem_token' | 'token_invalido'> {
  const token = autorizacao?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return 'sem_token';
  try {
    const payload = await verifyBearerToken(token, {
      verifyOptions: { issuer: deps.config.issuer, audience: deps.config.resource, typ: 'at+jwt', requiredClaims: ['azp', 'sub'] },
      // Chaves do próprio Better Auth, sem ir à rede (o Worker não busca o próprio endereço).
      jwksFetch: () => deps.auth.api.getJwks(),
    });
    if (typeof payload.sub !== 'string') return 'token_invalido';
    const existe = await deps.db.user.count({ where: { id: payload.sub } });
    return existe === 1 ? payload.sub : 'token_invalido';
  } catch {
    return 'token_invalido';
  }
}

/**
 * Servidor MCP do Pulo (Streamable HTTP, sem estado) em `/mcp`, e os metadados de descoberta do OAuth:
 * - `/.well-known/oauth-protected-resource/mcp` (RFC 9728): diz qual servidor de autorização emite tokens para o `/mcp`;
 * - `/.well-known/oauth-authorization-server/api/auth` e `/.well-known/openid-configuration/api/auth` (RFC 8414 e OIDC),
 *   também sem o sufixo, para clientes que não inserem o caminho do emissor.
 */
export function mcpRoutes(deps: McpDeps): Hono {
  const { config } = deps;
  const metadadosDoRecurso = {
    resource: config.resource,
    authorization_servers: [config.issuer],
    scopes_supported: [...MCP_SCOPES],
    bearer_methods_supported: ['header'],
    resource_name: 'Pulo',
  };
  const servidorDeAutorizacao = oauthProviderAuthServerMetadata(deps.auth);
  const openId = oauthProviderOpenIdConfigMetadata(deps.auth);

  return (
    new Hono()
      // Clientes MCP no navegador (ex.: MCP Inspector) leem a descoberta e chamam o /mcp de outras origens, sem cookie.
      .use('/.well-known/*', cors({ origin: '*' }))
      .use(MCP_PATH, cors({ origin: '*', allowHeaders: ['Authorization', 'Content-Type', 'Mcp-Protocol-Version'], exposeHeaders: ['WWW-Authenticate'] }))
      .get(`/.well-known/oauth-protected-resource${MCP_PATH}`, (c) => c.json(metadadosDoRecurso))
      .get('/.well-known/oauth-protected-resource', (c) => c.json(metadadosDoRecurso))
      .get(`/.well-known/oauth-authorization-server${AUTH_BASE_PATH}`, (c) => servidorDeAutorizacao(c.req.raw))
      .get('/.well-known/oauth-authorization-server', (c) => servidorDeAutorizacao(c.req.raw))
      .get(`/.well-known/openid-configuration${AUTH_BASE_PATH}`, (c) => openId(c.req.raw))
      .get(`${AUTH_BASE_PATH}/.well-known/openid-configuration`, (c) => openId(c.req.raw))
      .post(MCP_PATH, async (c) => {
        const userId = await pessoaDoToken(deps, c.req.header('authorization'));
        if (userId === 'sem_token') return naoAutorizado(config);
        if (userId === 'token_invalido') return naoAutorizado(config, 'invalid_token');

        const api = clienteInterno((request) => deps.chamarComo(userId, request));
        // O Workers não permite gerar código em tempo de execução (o Ajv padrão do SDK faz isso): validador do cfworker.
        const server = new McpServer({ name: 'pulo', title: 'Pulo', version: VERSAO }, { jsonSchemaValidator: new CfWorkerJsonSchemaValidator() });
        registrarFerramentas(server, { repo: repositorioInterno(api), api, clock: { now: deps.now } });
        // Sem estado: cada POST traz uma mensagem JSON-RPC e recebe a resposta em JSON (sem SSE).
        const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
        await server.connect(transport);
        return transport.handleRequest(c.req.raw);
      })
      // Sem sessão no servidor: não há stream (GET) nem sessão para encerrar (DELETE).
      .on(['GET', 'DELETE'], MCP_PATH, (c) => c.json({ jsonrpc: '2.0', error: { code: -32000, message: 'Use POST.' }, id: null }, 405))
  );
}
