import { HOUSE, ROOM_DECOR } from '@pulo/core/config/decisions';
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
const parte = (item: keyof typeof HOUSE.partCost, createdAt?: number) => compra(item, HOUSE.partCost[item], createdAt);
const decor = (item: keyof typeof ROOM_DECOR.itemCost, createdAt?: number) => ({
  ...compra(item, ROOM_DECOR.itemCost[item], createdAt),
  x: 1,
  y: 2,
  rotation: 90,
});
const casa = async (user: TestUser) => (await user.call('GET', '/api/house')).json();
const quarto = async (user: TestUser) => (await (await user.call('GET', '/api/room')).json()).decor;

/** Joias direto no banco, como ganho histórico. */
async function joias(user: TestUser, amount: number) {
  await database.db.joiaCredit.create({ data: { userId: user.id, amount } });
}

async function erro(res: Response) {
  return { status: res.status, error: (await res.json()).error };
}

describe('/api/house e /api/room', () => {
  it('exige sessão', async () => {
    expect((await h.app.request('/api/house')).status).toBe(401);
    expect((await h.app.request('/api/room')).status).toBe(401);
    expect((await h.app.request('/api/house/cerca', { method: 'PUT' })).status).toBe(401);
    expect((await h.app.request('/api/room/tapete', { method: 'PATCH' })).status).toBe(401);
  });

  it('compra uma parte, repetir é seguro e outro corpo é ja_comprado', async () => {
    const me = await h.newUser();
    await joias(me, 200);
    const res = await me.call('PUT', '/api/house/varanda', parte('varanda'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ purchase: parte('varanda') });
    expect((await me.call('PUT', '/api/house/varanda', parte('varanda'))).status).toBe(200);
    expect(await erro(await me.call('PUT', '/api/house/varanda', parte('varanda', TEST_NOW - 2)))).toEqual({ status: 409, error: 'ja_comprado' });
    expect(await casa(me)).toEqual({ purchases: [parte('varanda')], joiaCredit: 200 });
  });

  it('erros do catálogo, do saldo e do caminho', async () => {
    const me = await h.newUser();
    await joias(me, 9);
    const put = (path: string, body: unknown) => me.call('PUT', path, body);
    const sem = await put('/api/room/tapete', decor('tapete'));
    expect(sem.status).toBe(409);
    expect(await sem.json()).toEqual({ error: 'joias_insuficientes', message: 'Falta 1 joia.' });
    expect(await erro(await put('/api/house/praia', compra('praia', 40)))).toEqual({ status: 404, error: 'item_inexistente' });
    expect(await erro(await put('/api/house/cerca', compra('cerca', 1)))).toEqual({ status: 400, error: 'preco_divergente' });
    expect(await erro(await put('/api/house/quarto', parte('quarto')))).toEqual({ status: 409, error: 'ja_comprado' });
    expect(await erro(await put('/api/house/cerca', parte('jardim')))).toEqual({ status: 400, error: 'id_divergente' });
    expect(await erro(await put('/api/room/tapete', { ...decor('tapete'), x: 6 }))).toEqual({ status: 400, error: 'corpo_invalido' });
    expect(await erro(await put('/api/room/tapete', { ...decor('tapete'), rotation: 45 }))).toEqual({ status: 400, error: 'corpo_invalido' });
    expect(await quarto(me)).toEqual([]);
    expect((await casa(me)).purchases).toEqual([]);
  });

  it('decoração: compra com posição, move de graça e a repetição não desfaz a mudança', async () => {
    const me = await h.newUser();
    await joias(me, ROOM_DECOR.itemCost.tapete);
    const spot = { x: 5, y: 5, rotation: 270 };
    expect(await erro(await me.call('PATCH', '/api/room/tapete', spot))).toEqual({ status: 404, error: 'nao_encontrado' });
    expect(await erro(await me.call('PATCH', '/api/room/praia', spot))).toEqual({ status: 404, error: 'item_inexistente' });
    expect((await me.call('PUT', '/api/room/tapete', decor('tapete'))).status).toBe(200);
    const movido = await me.call('PATCH', '/api/room/tapete', spot);
    expect(await movido.json()).toEqual({ item: 'tapete', spot });
    const repetida = await me.call('PUT', '/api/room/tapete', decor('tapete'));
    expect(await repetida.json()).toEqual({ decor: { ...decor('tapete'), ...spot } });
    expect(await quarto(me)).toEqual([{ ...decor('tapete'), ...spot }]);

    const outra = await h.newUser();
    expect(await erro(await outra.call('PATCH', '/api/room/tapete', spot))).toEqual({ status: 404, error: 'nao_encontrado' });
    expect(await quarto(outra)).toEqual([]);
  });

  it('dois aparelhos comprando o mesmo item ao mesmo tempo: só um paga', async () => {
    const me = await h.newUser();
    await joias(me, 500);
    const [a, b] = await Promise.all([
      me.call('PUT', '/api/house/cerca', parte('cerca', TEST_NOW - 1)),
      me.call('PUT', '/api/house/cerca', parte('cerca', TEST_NOW - 2)),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await casa(me)).purchases).toHaveLength(1);
  });

  it('dois itens ao mesmo tempo não gastam o mesmo saldo', async () => {
    const me = await h.newUser();
    await joias(me, HOUSE.partCost.cerca);
    const [a, b] = await Promise.all([me.call('PUT', '/api/house/cerca', parte('cerca')), me.call('PUT', '/api/room/tapete', decor('tapete'))]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await casa(me)).purchases.length + (await quarto(me)).length).toBe(1);
  });

  it('quem tinha compras antigas mantém o saldo: elas não gastam joias na casa, e a ilha antiga desconta as novas', async () => {
    const me = await h.newUser();
    await joias(me, HOUSE.partCost.cerca);
    await database.db.islandPurchase.create({ data: { userId: me.id, item: 'praia', cost: 40, createdAt: new Date(TEST_NOW - 5) } });
    expect((await me.call('PUT', '/api/house/cerca', parte('cerca'))).status).toBe(200);
    expect(await erro(await me.call('PUT', '/api/island/purchases/banco', compra('banco', 8)))).toEqual({ status: 409, error: 'joias_insuficientes' });
    const sync = await (await me.call('GET', '/api/sync?from=2026-11-01&to=2026-11-30')).json();
    expect(sync).toMatchObject({
      islandPurchases: [{ item: 'praia', cost: 40, createdAt: TEST_NOW - 5 }],
      housePurchases: [parte('cerca')],
      roomDecor: [],
      joiaCredit: 40,
    });
  });

  it('apagar os dados remove casa, quarto e crédito', async () => {
    const me = await h.newUser();
    await joias(me, 100);
    await me.call('PUT', '/api/room/tapete', decor('tapete'));
    await me.call('PUT', '/api/house/cerca', parte('cerca'));
    const apagado = await (await me.call('DELETE', '/api/data')).json();
    expect(apagado.deleted.islandPurchases).toBe(2);
    expect(await casa(me)).toEqual({ purchases: [], joiaCredit: 0 });
    expect(await quarto(me)).toEqual([]);
    expect(await database.db.roomPlacement.count({ where: { userId: me.id } })).toBe(0);
  });

  it('queries do quarto e do sync: número fixo com 1 e com 50 decorações', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    for (const [user, n] of [[small, 1], [big, 50]] as const) {
      const ids = Array.from({ length: n }, (_, i) => `enfeite${i}`);
      await database.db.islandPurchase.createMany({
        data: ids.map((item) => ({ userId: user.id, item, kind: 'decoracao' as const, cost: 1, createdAt: new Date(TEST_NOW - 10) })),
      });
      await database.db.roomPlacement.createMany({ data: ids.map((item) => ({ userId: user.id, item, x: 0, y: 0, rotation: 0 })) });
    }
    for (const path of ['/api/room', '/api/sync?from=2026-11-01&to=2026-11-30']) {
      expect(await queriesOf(database, big, 'GET', path)).toBe(await queriesOf(database, small, 'GET', path));
    }
    expect(await quarto(big)).toHaveLength(50);
  });

  it('queries: número fixo com 1 e com 50 registros', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    for (const [user, n] of [[small, 1], [big, 50]] as const) {
      await joias(user, 500);
      await database.db.restDay.createMany({ data: Array.from({ length: n }, (_, i) => ({ userId: user.id, date: new Date(Date.UTC(2025, 0, 1 + i)) })) });
      await database.db.islandPurchase.createMany({
        data: Array.from({ length: n }, (_, i) => ({ userId: user.id, item: `antigo${i}`, cost: 1, createdAt: new Date(TEST_NOW - 10) })),
      });
    }
    const both = async (method: 'GET' | 'PUT', path: string, body?: unknown) => {
      const count = await queriesOf(database, small, method, path, body);
      expect(await queriesOf(database, big, method, path, body)).toBe(count);
      return count;
    };
    // 2 de sessão + 7 leituras + o insert.
    expect(await both('PUT', '/api/house/cerca', parte('cerca'))).toBe(11);
    // 2 de sessão + 7 leituras + 2 inserts + a leitura da resposta.
    expect(await both('PUT', '/api/room/tapete', decor('tapete'))).toBe(13);
    expect(await both('GET', '/api/house')).toBe(4);
    expect(await both('GET', '/api/room')).toBe(3);
    const spot = { x: 0, y: 0, rotation: 0 };
    for (const user of [small, big]) {
      const { result, count } = await database.countQueries(() => user.call('PATCH', '/api/room/tapete', spot));
      expect([result.status, count]).toEqual([200, 3]);
    }
  });
});
