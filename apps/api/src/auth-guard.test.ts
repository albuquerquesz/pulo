import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { createHarness } from './testing';

let database: TestDatabase;
let h: ReturnType<typeof createHarness>;

beforeAll(async () => {
  database = await createTestDatabase();
  h = createHarness(database);
});
afterAll(async () => {
  await database.close();
});

/**
 * Rotas públicas de propósito: saúde, login do Better Auth, a IA semanal (não toca nos dados da pessoa) e a descoberta do OAuth.
 * O `/mcp` exige token OAuth e tem o próprio teste (mcp/mcp.test.ts).
 */
const PUBLIC = [/^\/health$/, /^\/api\/auth\//, /^\/weekly-ai$/, /^\/\.well-known\//, /^\/mcp$/];

describe('autenticação das rotas de domínio', () => {
  it('toda rota registrada fora da lista pública responde 401 sem sessão', async () => {
    const routes = h.app.routes.filter((route) => route.method !== 'ALL' && !PUBLIC.some((rx) => rx.test(route.path)));
    expect(routes.length).toBeGreaterThanOrEqual(20);
    for (const route of routes) {
      const path = route.path
        .replace(':id', crypto.randomUUID())
        .replace(':habitId', crypto.randomUUID())
        .replace(':date', '2026-11-16')
        .replace(':item', 'banco')
        .replace(/\/$/, '');
      const res = await h.app.request(path, { method: route.method });
      expect(res.status, `${route.method} ${route.path}`).toBe(401);
      expect((await res.json()).error).toBe('nao_autenticado');
    }
  });

  it('cookie inválido também é 401 e rota inexistente é 404 em JSON', async () => {
    const res = await h.app.request('/api/blocks', { headers: { cookie: 'better-auth.session_token=lixo' } });
    expect(res.status).toBe(401);
    const missing = await h.app.request('/api/nada');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'rota_inexistente', message: 'Rota inexistente.' });
  });

  it('erro inesperado vira 500 sem stack trace', async () => {
    const me = await h.newUser();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const original = database.db.routineBlock.findMany;
    database.db.routineBlock.findMany = () => {
      throw new Error('falha secreta com /caminho/interno');
    };
    try {
      const res = await me.call('GET', '/api/blocks');
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(text).not.toContain('secreta');
      expect(text).not.toContain('at ');
      expect(JSON.parse(text).error).toBe('erro_interno');
    } finally {
      database.db.routineBlock.findMany = original;
      spy.mockRestore();
    }
  });
});
