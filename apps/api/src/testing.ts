// Apoio só para os testes: SQLite em memória com as mesmas migrações do D1.
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { serializeSignedCookie } from 'better-call';
import type { ApiEnv } from './app';
import type { Auth } from './auth';

const MIGRATIONS = new URL('../migrations/', import.meta.url);

export const testEnv: ApiEnv = {
  DB: { prepare: () => { throw new Error('use o SQLite do teste'); }, batch: async () => [], exec: async () => null },
  BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-00',
  BETTER_AUTH_URL: 'http://localhost:8787',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
};

export function createTestDatabase() {
  const database = new DatabaseSync(':memory:');
  for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort()) {
    database.exec(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
  }
  return database;
}

/** Cria um usuário com sessão e devolve o cookie assinado, como o navegador mandaria. */
export async function signIn(auth: Auth, email: string) {
  const context = await auth.$context;
  const user = await context.internalAdapter.createUser({ email, name: 'Pessoa Teste', emailVerified: true }, { method: 'admin' });
  const session = await context.internalAdapter.createSession(user.id, false);
  const cookie = await serializeSignedCookie(context.authCookies.sessionToken.name, session.token, testEnv.BETTER_AUTH_SECRET);
  return { user, cookie: cookie.split(';')[0] };
}
