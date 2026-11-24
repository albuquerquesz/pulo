// Atributos do Set-Cookie nas configurações de dev e de produção, lidos de respostas reais do Better Auth.
import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { createApp } from './app';
import { testEnv } from './testing';

let database: TestDatabase;
beforeAll(async () => {
  database = await createTestDatabase();
});
afterAll(async () => {
  await database.close();
});

/** Começa o login com Google: a resposta traz o cookie de estado do OAuth, que usa os mesmos atributos da sessão. */
async function loginCookies(env: typeof testEnv, origin: string): Promise<string[]> {
  const app = createApp(env, database.db);
  const res = await app.request('/api/auth/sign-in/social', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ provider: 'google', callbackURL: origin }),
  });
  expect(res.status).toBe(200);
  return res.headers.getSetCookie();
}

const attributes = (cookie: string) => cookie.split(';').slice(1).map((part) => part.trim());

describe('Set-Cookie do login', () => {
  it('dev (localhost, portas diferentes): HttpOnly, Lax, sem Secure e sem Domain', async () => {
    const cookies = await loginCookies(testEnv, 'http://localhost:3000');
    expect(cookies.length).toBeGreaterThan(0);
    for (const cookie of cookies) {
      const attrs = attributes(cookie);
      expect(attrs).toContain('HttpOnly');
      expect(attrs).toContain('SameSite=Lax');
      expect(attrs).toContain('Path=/');
      expect(attrs).not.toContain('Secure');
      expect(attrs.some((a) => a.startsWith('Domain='))).toBe(false);
      expect(cookie.startsWith('__Secure-')).toBe(false);
    }
  });

  it('produção em sites diferentes: HttpOnly, Secure, SameSite=None e só o host da API', async () => {
    const env = {
      ...testEnv,
      BETTER_AUTH_URL: 'https://pulo-api.conta.workers.dev',
      PULO_CORS_ORIGIN: 'https://pulo.pages.dev',
    };
    const cookies = await loginCookies(env, 'https://pulo.pages.dev');
    expect(cookies.length).toBeGreaterThan(0);
    for (const cookie of cookies) {
      const attrs = attributes(cookie);
      expect(attrs).toEqual(expect.arrayContaining(['HttpOnly', 'Secure', 'SameSite=None', 'Path=/']));
      expect(attrs.some((a) => a.startsWith('Domain='))).toBe(false);
    }
  });

  it('produção com app. e api.: HttpOnly, Secure, SameSite=Lax e Domain compartilhado', async () => {
    const env = {
      ...testEnv,
      BETTER_AUTH_URL: 'https://api.exemplo.com',
      PULO_CORS_ORIGIN: 'https://app.exemplo.com',
      PULO_COOKIE_DOMAIN: 'exemplo.com',
    };
    const cookies = await loginCookies(env, 'https://app.exemplo.com');
    expect(cookies.length).toBeGreaterThan(0);
    for (const cookie of cookies) {
      expect(attributes(cookie)).toEqual(expect.arrayContaining(['HttpOnly', 'Secure', 'SameSite=Lax', 'Domain=exemplo.com']));
    }
  });

  it('a sessão usa os mesmos atributos (cookie de sessão do Better Auth)', async () => {
    const env = { ...testEnv, BETTER_AUTH_URL: 'https://api.exemplo.com', PULO_CORS_ORIGIN: 'https://app.exemplo.com', PULO_COOKIE_DOMAIN: 'exemplo.com' };
    const { createAuth } = await import('./auth');
    const { resolveWebConfig } = await import('./web-config');
    const context = await createAuth(env, resolveWebConfig(env), database.db).$context;
    expect(context.authCookies.sessionToken.name).toBe('__Secure-better-auth.session_token');
    expect(context.authCookies.sessionToken.attributes).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  });
});
