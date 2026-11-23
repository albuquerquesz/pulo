import type { Db } from '@pulo/db';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { type WebConfig, resolveWebConfig } from './web-config';

export type AuthEnv = {
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
