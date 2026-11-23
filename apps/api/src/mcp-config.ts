/**
 * Endereços do servidor MCP e do OAuth que o protege, todos derivados do ambiente.
 * O Better Auth é o servidor de autorização (emissor `.../api/auth`); o recurso protegido é `.../mcp`.
 */
export interface McpEnv {
  /** Endereço público da API. */
  BETTER_AUTH_URL: string;
  /** Endereço do app web, onde ficam as telas de entrar e de consentimento do OAuth. Padrão: o web local. */
  PULO_WEB_URL?: string | undefined;
}

export const DEFAULT_WEB_URL = 'http://localhost:3000';
export const MCP_PATH = '/mcp';
export const AUTH_BASE_PATH = '/api/auth';
/** Escopos pedidos por quem conecta uma IA: identidade (OpenID) e o token de renovação. */
export const MCP_SCOPES = ['openid', 'profile', 'email', 'offline_access'] as const;

export interface McpConfig {
  /** Emissor dos tokens (RFC 8414): a base do Better Auth. */
  issuer: string;
  /** Recurso protegido (RFC 8707 e 9728): o `aud` dos tokens aceitos no `/mcp`. */
  resource: string;
  /** Onde o cliente MCP descobre o servidor de autorização (RFC 9728). */
  resourceMetadataUrl: string;
  loginPage: string;
  consentPage: string;
}

const semBarraNoFim = (url: string) => url.replace(/\/+$/, '');

export function resolveMcpConfig(env: McpEnv): McpConfig {
  const api = semBarraNoFim(new URL(env.BETTER_AUTH_URL).toString());
  const web = semBarraNoFim(new URL(env.PULO_WEB_URL ?? DEFAULT_WEB_URL).toString());
  return {
    issuer: `${api}${AUTH_BASE_PATH}`,
    resource: `${api}${MCP_PATH}`,
    resourceMetadataUrl: `${api}/.well-known/oauth-protected-resource${MCP_PATH}`,
    loginPage: `${web}/oauth/entrar`,
    consentPage: `${web}/oauth/consentimento`,
  };
}
