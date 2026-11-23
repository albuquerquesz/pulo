import type { Db } from '@pulo/db';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

export type AuthEnv = {
  /** Conexão do Postgres (secret do Worker; em dev, .dev.vars). Direta ou do pooler do Supabase. */
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
};

/**
 * Better Auth com login pelo Google. As tabelas (user, session, account, verification) são do schema Prisma
 * de @pulo/db. O cliente `db` é por requisição: quem chama cria e fecha (ver worker.ts).
 */
export function createAuth(env: AuthEnv, origins: string[], db: Db) {
  return betterAuth({
    database: prismaAdapter(db, { provider: 'postgresql' }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: origins,
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
      // O app web e a API ficam em sites diferentes: o cookie precisa ir em requisições cross-site.
      defaultCookieAttributes: { sameSite: 'none', secure: true },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
