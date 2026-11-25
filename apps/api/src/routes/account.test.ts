import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { rowsByTable, seedEverything } from '../account-fixtures';
import { TEST_ORIGIN, createHarness, queriesOf } from '../testing';

let database: TestDatabase;
let h: ReturnType<typeof createHarness>;

beforeAll(async () => {
  database = await createTestDatabase();
  h = createHarness(database);
});
afterAll(async () => {
  await database.close();
});

const CONFIRM = { confirm: 'EXCLUIR' };

describe('DELETE /api/account', () => {
  it('exige sessão, origem do app e a confirmação', async () => {
    expect((await h.app.request('/api/account', { method: 'DELETE' })).status).toBe(401);
    const me = await h.newUser();
    for (const body of [undefined, {}, { confirm: 'excluir' }]) {
      const res = await me.call('DELETE', '/api/account', body);
      expect(res.status).toBe(400);
    }
    const deFora = await h.app.request('/api/account', {
      method: 'DELETE',
      headers: { cookie: me.cookie, origin: 'https://outro.example', 'content-type': 'application/json' },
      body: JSON.stringify(CONFIRM),
    });
    expect(deFora.status).toBe(403);
    expect(await database.db.user.count({ where: { id: me.id } })).toBe(1);
  });

  it('apaga o login e todas as linhas da pessoa, limpa o cookie e não toca em outra pessoa', async () => {
    const me = await h.newUser();
    const other = await h.newUser();
    await seedEverything(database, me.id, 'minha');
    await seedEverything(database, other.id, 'dela');
    const mine = await rowsByTable(database, me.id);
    // A semente cobre todas as tabelas com userId (tabela nova precisa entrar nela).
    expect(Object.entries(mine).filter(([, n]) => n === 0)).toEqual([]);
    const theirs = await rowsByTable(database, other.id);
    const verifications = await database.db.verification.count();

    const res = await me.call('DELETE', '/api/account', CONFIRM);
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(res.headers.getSetCookie().join('\n')).toMatch(/session_token=;[^\n]*Max-Age=0/i);

    expect(await database.db.user.count({ where: { id: me.id } })).toBe(0);
    expect(Object.entries(await rowsByTable(database, me.id)).filter(([, n]) => n > 0)).toEqual([]);
    expect(await database.db.verification.count({ where: { value: { contains: me.id } } })).toBe(0);
    expect(await database.db.verification.count()).toBe(verifications - 1);
    expect(await rowsByTable(database, other.id)).toEqual(theirs);
    expect((await other.call('GET', '/api/me')).status).toBe(200);
    // O login some: o mesmo cookie não vale mais.
    expect((await me.call('GET', '/api/me')).status).toBe(401);
    expect((await me.call('DELETE', '/api/account', CONFIRM)).status).toBe(401);
  });

  it('um cliente OAuth dela que outra pessoa usa só perde o dono', async () => {
    const me = await h.newUser();
    const other = await h.newUser();
    const { clientId } = await seedEverything(database, me.id, 'partilha');
    await database.db.oauthConsent.create({ data: { id: 'consentimento-alheio', clientId, userId: other.id, scopes: [] } });
    expect((await me.call('DELETE', '/api/account', CONFIRM)).status).toBe(200);
    expect(await database.db.oauthClient.findUnique({ where: { clientId }, select: { userId: true } })).toEqual({ userId: null });
    expect(await database.db.oauthConsent.count({ where: { userId: other.id } })).toBe(1);
  });

  it('queries: número fixo com 1 e com 50 registros', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    await seedEverything(database, small.id, 'pequena');
    await seedEverything(database, big.id, 'grande', 50);
    const one = await queriesOf(database, small, 'DELETE', '/api/account', CONFIRM);
    expect(await queriesOf(database, big, 'DELETE', '/api/account', CONFIRM)).toBe(one);
  });
});

describe('POST /api/auth/update-user (nome e foto)', () => {
  const update = (cookie: string, body: unknown, origin = TEST_ORIGIN) =>
    h.app.request('/api/auth/update-user', { method: 'POST', headers: { cookie, origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });

  it('muda nome e foto, e o sync devolve', async () => {
    const me = await h.newUser();
    const res = await update(me.cookie, { name: '  Novo Nome  ', image: 'https://example.com/foto.png' });
    expect(res.status, await res.clone().text()).toBe(200);
    const { user } = await (await me.call('GET', '/api/me')).json();
    expect(user).toMatchObject({ name: 'Novo Nome', image: 'https://example.com/foto.png' });
    expect((await update(me.cookie, { image: null })).status).toBe(200);
    expect((await (await me.call('GET', '/api/me')).json()).user).toMatchObject({ name: 'Novo Nome', image: null });
  });

  it('recusa nome vazio ou longo, foto que não é https e campos como metadata ou email', async () => {
    const me = await h.newUser();
    for (const body of [{ name: ' ' }, { name: 'x'.repeat(81) }, { image: 'javascript:alert(1)' }, { image: 'http://example.com/a.png' }, { metadata: {} }, { email: 'a@b.co' }]) {
      const res = await update(me.cookie, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect((await (await me.call('GET', '/api/me')).json()).user).toMatchObject({ name: 'Pessoa Teste', image: null });
  });
});
