import { accountUpdateSchema } from '@pulo/core/api/schemas';
import { ACCOUNT } from '@pulo/core/config/decisions';
import type { Db } from '@pulo/db';
import { oauthProvider } from '@better-auth/oauth-provider';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { jwt } from 'better-auth/plugins';
import { MCP_SCOPES, type McpEnv, resolveMcpConfig } from './mcp-config';
import { type WebConfig, resolveWebConfig } from './web-config';

export type AuthEnv = McpEnv & {
  /** Conexão do Postgres (secret do Worker; em dev, .dev.vars). Direta ou do pooler do Supabase. */
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  /** Opcional: domínio pai do cookie para `app.x` e `api.x` (veja web-config.ts e docs/web-auth.md). */
  PULO_COOKIE_DOMAIN?: string | undefined;
};

/**
 * Better Auth com login pelo Google. As tabelas (user, session, account, verification) são do schema Prisma
 * de @pulo/db. O cliente `db` é por requisição: quem chama cria e fecha (ver worker.ts).
 */
export function createAuth(env: AuthEnv, web: WebConfig, db: Db) {
  const { cookie } = web;
  const mcp = resolveMcpConfig(env);
  return betterAuth({
    database: prismaAdapter(db, { provider: 'postgresql' }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: web.origins,
    user: {
      additionalFields: {
        // JSON com preferências e progresso (ver @pulo/core/domain/user-metadata).
        // Só a rota /api/me/metadata escreve aqui, com validação.
        metadata: { type: 'json', required: false, input: false },
      },
    },
    // Nome e foto mudam pelo `/update-user` do Better Auth, com os limites do app.
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/update-user') return;
        const parsed = accountUpdateSchema.safeParse(ctx.body);
        if (!parsed.success) {
          throw new APIError('BAD_REQUEST', {
            code: 'corpo_invalido',
            message: `Use um nome de até ${ACCOUNT.nameMaxChars} letras e uma foto com endereço https.`,
          });
        }
        return { context: { body: parsed.data } };
      }),
    },
    // O `/token` do plugin jwt emitiria JWT de sessão; só o OAuth emite tokens (ver docs/mcp.md).
    disabledPaths: ['/token'],
    plugins: [
      // Chaves que assinam os access tokens do OAuth (tabela jwks). Sem cabeçalho de JWT nas respostas da sessão.
      jwt({ disableSettingJwtHeader: true }),
      // Servidor de autorização OAuth 2.1 para clientes MCP (Claude e outros): registro dinâmico de clientes,
      // login e consentimento nas telas do app web, tokens com `aud` = o recurso `/mcp`.
      oauthProvider({
        loginPage: mcp.loginPage,
        consentPage: mcp.consentPage,
        scopes: [...MCP_SCOPES],
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
        // Claude Code, Cursor e outros clientes nativos voltam para http://localhost ou um esquema próprio sem dizer
        // `application_type`: tratados como nativos; clientes web (claude.ai) seguem exigindo https.
        clientRegistrationDefaultApplicationType: 'infer',
        resources: [{ identifier: mcp.resource, name: 'Pulo MCP', allowedScopes: [...MCP_SCOPES] }],
        clientRegistrationDefaultResources: [mcp.resource],
        // O Worker monta o Better Auth a cada requisição: semear o recurso uma vez por processo.
        resourceSeedScope: 'process',
      }),
    ],
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    advanced: {
      // Sempre checar a origem, inclusive nos testes (o padrão do Better Auth desliga em NODE_ENV=test).
      disableOriginCheck: false,
      // O Worker não recebe X-Forwarded-For: o IP real vem neste cabeçalho.
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      // O cookie da sessão é decidido pelo ambiente (web-config.ts): HttpOnly sempre; Secure em https;
      // SameSite=Lax com app e API no mesmo site, None quando são sites diferentes.
      useSecureCookies: cookie.secure,
      defaultCookieAttributes: { httpOnly: cookie.httpOnly, secure: cookie.secure, sameSite: cookie.sameSite, path: cookie.path },
      // Domínio compartilhado só quando pedido (app.x e api.x); sem ele o cookie vale só para o host da API.
      ...(cookie.domain ? { crossSubDomainCookies: { enabled: true, domain: cookie.domain } } : {}),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
