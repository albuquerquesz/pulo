import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { TEST_ORIGIN, createHarness } from './testing';

let database: TestDatabase;
let h: ReturnType<typeof createHarness>;

beforeAll(async () => {
  database = await createTestDatabase();
  h = createHarness(database);
});
afterAll(async () => {
  await database.close();
});

const uuid = () => crypto.randomUUID();
const block = (id: string) => ({ id, weekday: 1, startMinutes: 540, durationMinutes: 50, kind: 'foco' });

function send(cookie: string, method: string, path: string, headers: Record<string, string>, body?: unknown) {
  return h.app.request(path, {
    method,
    headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe('proteção CSRF por Origin nas rotas com cookie', () => {
  it('origem configurada passa em PUT, PATCH, POST e DELETE', async () => {
    const me = await h.newUser();
    const id = uuid();
    expect((await send(me.cookie, 'PUT', `/api/blocks/${id}`, { origin: TEST_ORIGIN }, block(id))).status).toBe(200);
    expect((await send(me.cookie, 'PATCH', '/api/me/metadata', { origin: TEST_ORIGIN }, { theme: 'escuro' })).status).toBe(200);
    expect((await send(me.cookie, 'DELETE', `/api/blocks/${id}`, { origin: TEST_ORIGIN })).status).toBe(200);
    // POST sem rota de domínio com cookie: passa pela guarda e cai no 404 padrão (não no 403).
    expect((await send(me.cookie, 'POST', '/api/nada', { origin: TEST_ORIGIN }, {})).status).toBe(404);
  });

  it('outra origem recebe 403 origem_nao_permitida e nada é gravado', async () => {
    const me = await h.newUser();
    const id = uuid();
    for (const origin of ['https://intruso.example', 'null', 'http://localhost:9999', 'http://localhost:3000.intruso.example']) {
      const res = await send(me.cookie, 'PUT', `/api/blocks/${id}`, { origin }, block(id));
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe('origem_nao_permitida');
    }
    for (const [method, path] of [
      ['DELETE', `/api/blocks/${id}`],
      ['PATCH', '/api/me/metadata'],
      ['POST', '/api/qualquer'],
    ] as const) {
      const res = await send(me.cookie, method, path, { origin: 'https://intruso.example' }, {});
      expect(res.status).toBe(403);
    }
    expect((await (await me.call('GET', '/api/blocks')).json()).blocks).toEqual([]);
  });

  it('sem Origin, mas com cookie ou cabeçalho de navegador: 403 origem_ausente', async () => {
    const me = await h.newUser();
    const id = uuid();
    const withCookie = await send(me.cookie, 'PUT', `/api/blocks/${id}`, {}, block(id));
    expect(withCookie.status).toBe(403);
    expect((await withCookie.json()).error).toBe('origem_ausente');

    const browser = await h.app.request(`/api/blocks/${id}`, { method: 'DELETE', headers: { 'sec-fetch-site': 'cross-site' } });
    expect(browser.status).toBe(403);
    expect((await browser.json()).error).toBe('origem_ausente');
  });

  it('sem Origin e sem nada de navegador segue para o 401 da sessão', async () => {
    const res = await h.app.request(`/api/blocks/${uuid()}`, { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('GET não é afetado, nem com origem estranha ou ausente', async () => {
    const me = await h.newUser();
    expect((await send(me.cookie, 'GET', '/api/blocks', { origin: 'https://intruso.example' })).status).toBe(200);
    expect((await send(me.cookie, 'GET', '/api/blocks', {})).status).toBe(200);
  });

  it('/api/auth/* fica com o Better Auth (a mesma recusa de origem que ele já faz)', async () => {
    const res = await h.app.request('/api/auth/sign-in/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://intruso.example' },
      body: JSON.stringify({ provider: 'google', callbackURL: 'https://intruso.example' }),
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error).not.toBe('origem_nao_permitida');
  });
});
