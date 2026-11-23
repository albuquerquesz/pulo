// Apoio só para os testes da API: ambiente fictício e login sem passar pelo Google.
// O banco é o Postgres de teste do @pulo/db (createTestDatabase), um banco novo por arquivo.
import { randomUUID } from 'node:crypto';
import { DEFAULT_USER_METADATA } from '@pulo/core/domain/user-metadata';
import type { TestDatabase } from '@pulo/db/testing';
import { serializeSignedCookie } from 'better-call';
import { type ApiEnv, createApp } from './app';
import { type Auth, createAuth } from './auth';
import { resolveWebConfig } from './web-config';

export const testEnv: ApiEnv = {
  DATABASE_URL: 'postgresql://nao-usado-nos-testes',
  BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-00',
  BETTER_AUTH_URL: 'http://localhost:8787',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
};

/** Cria um usuário com sessão e devolve o cookie assinado, como o navegador mandaria. */
export async function signIn(auth: Auth, email: string) {
  const context = await auth.$context;
  const user = await context.internalAdapter.createUser({ email, name: 'Pessoa Teste', emailVerified: true }, { method: 'admin' });
  const session = await context.internalAdapter.createSession(user.id, false);
  const cookie = await serializeSignedCookie(context.authCookies.sessionToken.name, session.token, context.secret);
  return { user, cookie: cookie.split(';')[0] };
}

// ---------- Harness das rotas de domínio ----------

export const TEST_NOW = 1_795_000_000_000;
export const TEST_ORIGIN = 'http://localhost:8081';

export type TestApp = ReturnType<typeof createApp>;

/** Uma pessoa logada: faz chamadas JSON na API com o cookie da sessão. */
export interface TestUser {
  id: string;
  cookie: string;
  call(method: 'GET' | 'PUT' | 'DELETE' | 'PATCH', path: string, body?: unknown): Promise<Response>;
}

/** App + banco de teste + criação de pessoas logadas, com `now` fixo (ou ajustável por `setNow`). */
export function createHarness(database: TestDatabase) {
  let now = TEST_NOW;
  const auth = createAuth(testEnv, resolveWebConfig(testEnv), database.db);
  const app = createApp(testEnv, database.db, () => now);
  let counter = 0;

  async function newUser(metadata?: { timezone: string }): Promise<TestUser> {
    counter += 1;
    const { user, cookie } = await signIn(auth, `pessoa${counter}-${randomUUID()}@example.com`);
    if (metadata) {
      const context = await auth.$context;
      await context.internalAdapter.updateUser(user.id, { metadata: { ...DEFAULT_USER_METADATA, ...metadata } });
    }
    return {
      id: user.id,
      cookie,
      call: async (method, path, body) =>
        app.request(path, {
          method,
          headers: { cookie, origin: TEST_ORIGIN, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
    };
  }

  return { app, auth, newUser, setNow: (value: number) => void (now = value), now: () => now };
}

/** Quantas queries SQL uma chamada faz (inclui as 2 da sessão do Better Auth). Falha mostrando o SQL se a resposta não for a esperada. */
export async function queriesOf(
  database: TestDatabase,
  user: TestUser,
  method: 'GET' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  expectedStatus = 200,
): Promise<number> {
  const { result, count, queries } = await database.countQueries(() => user.call(method, path, body));
  if (result.status !== expectedStatus) {
    throw new Error(`${method} ${path} respondeu ${result.status}: ${await result.text()}\n${queries.join('\n')}`);
  }
  if (process.env.PULO_PRINT_QUERIES) console.info(`QUERIES ${method} ${path.replace(/[0-9a-f-]{36}/g, ':id')} = ${count}\n${queries.join('\n')}`);
  return count;
}
