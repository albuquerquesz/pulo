import { HOUSE, JOIAS } from '@pulo/core/config/decisions';
import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { type TestUser, TEST_NOW, createHarness, queriesOf } from '../testing';

let database: TestDatabase;
let h: ReturnType<typeof createHarness>;

beforeAll(async () => {
  database = await createTestDatabase();
  h = createHarness(database);
});
afterAll(async () => {
  await database.close();
});

const compra = (item: string, cost: number, createdAt = TEST_NOW - 1) => ({ item, cost, createdAt });
const listar = async (user: TestUser) => (await (await user.call('GET', '/api/island/purchases')).json()).purchases;

/** Uma compra antiga direto no banco (a API não grava mais na ilha). */
async function antiga(user: TestUser, item: string, cost: number) {
  await database.db.islandPurchase.create({ data: { userId: user.id, item, cost, createdAt: new Date(TEST_NOW - 1) } });
}

describe('/api/island', () => {
  it('exige sessão', async () => {
    expect((await h.app.request('/api/island/purchases')).status).toBe(401);
  });

  it('não grava mais compras', async () => {
    const me = await h.newUser();
    const res = await me.call('PUT', '/api/island/purchases/banco', compra('banco', 8));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('rota_inexistente');
    expect(await listar(me)).toEqual([]);
  });

  it('lê só as compras de quem pediu, e o sync traz as mesmas', async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    await antiga(a, 'banco', 8);
    expect(await listar(a)).toEqual([compra('banco', 8)]);
    expect(await listar(b)).toEqual([]);
    const sync = await (await a.call('GET', '/api/sync?from=2026-11-01&to=2026-11-30')).json();
    expect(sync.islandPurchases).toEqual([compra('banco', 8)]);
  });

  it('a ponte antiga, gravada com prefixo, é lida sem ele e não impede a ponte da casa', async () => {
    const me = await h.newUser();
    await antiga(me, 'antiga:ponte', 20);
    expect(await listar(me)).toEqual([compra('ponte', 20)]);

    await database.db.islandPurchase.create({ data: { userId: me.id, item: 'lago', kind: 'casa', cost: HOUSE.partCost.lago, createdAt: new Date(TEST_NOW - 1) } });
    const dias = Math.ceil((HOUSE.partCost.lago + HOUSE.partCost.ponte) / JOIAS.por.restDay);
    await database.db.restDay.createMany({ data: Array.from({ length: dias }, (_, i) => ({ userId: me.id, date: new Date(Date.UTC(2024, 0, 1 + i)) })) });
    expect((await me.call('PUT', '/api/house/ponte', compra('ponte', HOUSE.partCost.ponte))).status).toBe(200);
    expect(await listar(me)).toEqual([compra('ponte', 20)]);
  });

  it('queries: número fixo com poucas e com muitas compras', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    await antiga(big, 'banco', 8);
    await antiga(big, 'praia', 40);
    const get = await queriesOf(database, small, 'GET', '/api/island/purchases');
    expect(await queriesOf(database, big, 'GET', '/api/island/purchases')).toBe(get);
    expect(get).toBe(3);
  });
});
