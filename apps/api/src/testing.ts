// Apoio só para os testes da API: ambiente fictício e login sem passar pelo Google.
// O banco é o Postgres de teste do @pulo/db (createTestDatabase), um banco novo por arquivo.
import { serializeSignedCookie } from 'better-call';
import type { ApiEnv } from './app';
import type { Auth } from './auth';

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
