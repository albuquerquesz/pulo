import { oauthProviderClient } from '@better-auth/oauth-provider/client';
import { createAuthClient } from 'better-auth/client';

import { ambienteDoApp, apiUrl } from '../sessao/config';

/**
 * Cliente do Better Auth com o plugin do servidor OAuth: nas telas de entrar e de consentimento, ele manda junto
 * a consulta assinada (`oauth_query`) que veio na URL, para o servidor continuar o pedido da IA que quer se conectar.
 */
export function clienteOAuth() {
  const baseURL = apiUrl(ambienteDoApp(), import.meta.env.DEV);
  if (!baseURL) return null;
  return createAuthClient({ baseURL, fetchOptions: { credentials: 'include' }, plugins: [oauthProviderClient()] });
}

export type ClienteOAuth = NonNullable<ReturnType<typeof clienteOAuth>>;

/** Nomes amigáveis dos escopos que um cliente MCP pede. */
const ESCOPOS: Record<string, string> = {
  openid: 'Saber que é você',
  profile: 'Ver seu nome',
  email: 'Ver seu email',
  offline_access: 'Continuar conectado sem pedir de novo',
};

export function escoposLegiveis(escopo: string | null): string[] {
  return (escopo ?? '')
    .split(' ')
    .filter(Boolean)
    .map((s) => ESCOPOS[s] ?? s);
}
