// O app web fica em outro site que a API: o navegador só manda o cookie se o CORS aceitar credenciais para a origem exata.
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

describe('CORS com credenciais para o app web', () => {
  it('preflight de PUT com JSON aceita a origem do app, os métodos e o cookie', async () => {
    const res = await h.app.request('/api/blocks/abc', {
      method: 'OPTIONS',
      headers: {
        origin: TEST_ORIGIN,
        'access-control-request-method': 'PUT',
        'access-control-request-headers': 'content-type',
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(TEST_ORIGIN);
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    expect(res.headers.get('access-control-allow-methods')).toMatch(/PUT/);
    expect(res.headers.get('access-control-allow-methods')).toMatch(/DELETE/);
    expect(res.headers.get('access-control-allow-methods')).toMatch(/PATCH/);
    expect(res.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('content-type');
  });

  it('a resposta real devolve a origem exata (nunca *) com credenciais', async () => {
    const me = await h.newUser();
    const res = await me.call('GET', '/api/blocks');
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(TEST_ORIGIN);
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('origem desconhecida não ganha permissão', async () => {
    const res = await h.app.request('/api/blocks', { headers: { origin: 'https://intruso.example' } });
    expect(res.headers.get('access-control-allow-origin')).not.toBe('https://intruso.example');
    expect(res.headers.get('access-control-allow-origin')).not.toBe('*');
  });
});
