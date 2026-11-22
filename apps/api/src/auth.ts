import type { BetterAuthOptions, D1Database } from '@better-auth/core';
import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';

export type AuthEnv = {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
};

export type AuthDatabase = BetterAuthOptions['database'];

/** Esquema do app (app.json), para o login voltar ao app nativo. */
const APP_SCHEME = 'pulo://';

/**
 * Better Auth com login pelo Google. O banco é o D1 do Worker por padrão;
 * os testes e a geração do schema passam outro banco SQLite.
 */
export function createAuth(env: AuthEnv, origins: string[], database: AuthDatabase = env.DB) {
  return betterAuth({
    database,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [...origins, APP_SCHEME],
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    plugins: [expo()],
    advanced: {
      // Sempre checar a origem, inclusive nos testes (o padrão do Better Auth desliga em NODE_ENV=test).
      disableOriginCheck: false,
      // O Worker não recebe X-Forwarded-For: o IP real vem neste cabeçalho.
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      // O app web e a API ficam em sites diferentes: o cookie precisa ir em requisições cross-site.
      defaultCookieAttributes: { sameSite: 'none', secure: true },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
