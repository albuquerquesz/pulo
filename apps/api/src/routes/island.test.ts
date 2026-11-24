import { ISLAND } from '@pulo/core/config/decisions';
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

const uuid = () => crypto.randomUUID();
const compra = (item: string, cost: number, createdAt = TEST_NOW - 1) => ({ item, cost, createdAt });
const comprar = (user: TestUser, item: string, cost: number, createdAt?: number) =>
  user.call('PUT', `/api/island/purchases/${item}`, compra(item, cost, createdAt));
const listar = async (user: TestUser) => (await (await user.call('GET', '/api/island/purchases')).json()).purchases;

/** Marca `n` hábitos feitos pela própria API (uma mosca cada), como o app faria. */
async function moscasPorHabito(user: TestUser, n: number) {
  const habitId = uuid();
  await user.call('PUT', `/api/habits/${habitId}`, { id: habitId, title: 'Ler', weekdays: [0, 1, 2, 3, 4, 5, 6], active: true });
  for (let i = 0; i < n; i += 1) {
    const date = `2026-10-${String(i + 1).padStart(2, '0')}`;
    const res = await user.call('PUT', `/api/habit-logs/${habitId}/${date}`, { habitId, date, doneAt: TEST_NOW - 1 });
    expect(res.status).toBe(200);
  }
}

/** Muitas moscas de uma vez, direto no banco: `n` dias de descanso valem `n * ISLAND.fliesPer.restDay`. */
async function moscasPorDescanso(user: TestUser, n: number) {
  await database.db.restDay.createMany({ data: Array.from({ length: n }, (_, i) => ({ userId: user.id, date: new Date(Date.UTC(2025, 0, 1 + i)) })) });
}

async function erro(res: Response) {
  return { status: res.status, error: (await res.json()).error };
}

describe('/api/island', () => {
  it('exige sessão', async () => {
    expect((await h.app.request('/api/island/purchases')).status).toBe(401);
    expect((await h.app.request('/api/island/purchases/banco', { method: 'PUT' })).status).toBe(401);
  });

  it('pessoa nova não tem compras', async () => {
    const me = await h.newUser();
    expect(await listar(me)).toEqual([]);
  });

  it('compra um enfeite com moscas suficientes, e repetir a mesma compra é seguro', async () => {
    const me = await h.newUser();
    await moscasPorHabito(me, ISLAND.decorCost.banco);
    const res = await comprar(me, 'banco', ISLAND.decorCost.banco);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ purchase: compra('banco', 8) });
    expect(await listar(me)).toEqual([compra('banco', 8)]);

    // Retry do mesmo corpo: 200 sem gastar de novo.
    expect((await comprar(me, 'banco', 8)).status).toBe(200);
    // O mesmo item com outro corpo não é uma compra nova.
    expect(await erro(await comprar(me, 'banco', 8, TEST_NOW - 2))).toEqual({ status: 409, error: 'ja_comprado' });
    expect(await listar(me)).toEqual([compra('banco', 8)]);
  });

  it('recusa sem moscas suficientes, com a mensagem de quanto falta', async () => {
    const me = await h.newUser();
    await moscasPorHabito(me, 3);
    const res = await comprar(me, 'banco', 8);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'moscas_insuficientes', message: 'Faltam 5 moscas.' });
    expect(await listar(me)).toEqual([]);
  });

  it('áreas na ordem do mapa e enfeite só em área aberta', async () => {
    const me = await h.newUser();
    await moscasPorDescanso(me, 200);
    expect(await erro(await comprar(me, 'bosque', ISLAND.areaCost.bosque))).toEqual({ status: 409, error: 'fora_de_ordem' });
    expect(await erro(await comprar(me, 'guardaSol', ISLAND.decorCost.guardaSol))).toEqual({ status: 409, error: 'area_fechada' });
    expect(await erro(await comprar(me, 'lagoa', ISLAND.areaCost.lagoa))).toEqual({ status: 409, error: 'ja_comprado' });

    expect((await comprar(me, 'praia', ISLAND.areaCost.praia)).status).toBe(200);
    expect((await comprar(me, 'guardaSol', ISLAND.decorCost.guardaSol)).status).toBe(200);
    expect((await comprar(me, 'bosque', ISLAND.areaCost.bosque)).status).toBe(200);
    expect((await listar(me)).map((p: { item: string }) => p.item).sort()).toEqual(['bosque', 'guardaSol', 'praia']);
  });

  it('o preço e o item vêm do catálogo: custo errado, item inexistente e caminho divergente', async () => {
    const me = await h.newUser();
    await moscasPorDescanso(me, 50);
    expect(await erro(await comprar(me, 'banco', 0))).toEqual({ status: 400, error: 'preco_divergente' });
    expect(await erro(await comprar(me, 'banco', 99))).toEqual({ status: 400, error: 'preco_divergente' });
    expect(await erro(await comprar(me, 'castelo_voador', 1))).toEqual({ status: 404, error: 'item_inexistente' });
    expect(await erro(await me.call('PUT', '/api/island/purchases/banco', compra('lanterna', 12)))).toEqual({ status: 400, error: 'id_divergente' });
    expect(await erro(await comprar(me, 'banco', 8, TEST_NOW + 60 * 60_000))).toEqual({ status: 400, error: 'horario_no_futuro' });
    for (const bad of [{ item: 'banco', cost: -8, createdAt: 1 }, { item: 'banco', cost: 8.5, createdAt: 1 }, { item: 'banco', cost: 8 }]) {
      expect((await me.call('PUT', '/api/island/purchases/banco', bad)).status).toBe(400);
    }
    expect(await listar(me)).toEqual([]);
  });

  it('duas compras ao mesmo tempo não gastam o mesmo saldo', async () => {
    const me = await h.newUser();
    await moscasPorDescanso(me, ISLAND.decorCost.ponte / ISLAND.fliesPer.restDay);
    const [a, b] = await Promise.all([comprar(me, 'lanterna', ISLAND.decorCost.lanterna), comprar(me, 'ponte', ISLAND.decorCost.ponte)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await listar(me)).toHaveLength(1);
  });

  it('isolamento: as moscas e as compras de uma pessoa não valem para outra', async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    await moscasPorHabito(a, 8);
    expect((await comprar(a, 'banco', 8)).status).toBe(200);
    expect(await listar(b)).toEqual([]);
    expect(await erro(await comprar(b, 'banco', 8))).toEqual({ status: 409, error: 'moscas_insuficientes' });
    expect(await listar(a)).toEqual([compra('banco', 8)]);
  });

  it('o sync traz as compras e apagar os dados remove', async () => {
    const me = await h.newUser();
    await moscasPorHabito(me, 8);
    await comprar(me, 'banco', 8);
    const sync = await (await me.call('GET', '/api/sync?from=2026-11-01&to=2026-11-30')).json();
    expect(sync.islandPurchases).toEqual([compra('banco', 8)]);

    const apagado = await (await me.call('DELETE', '/api/data')).json();
    expect(apagado.deleted.islandPurchases).toBe(1);
    expect(await listar(me)).toEqual([]);
  });

  it('queries: número fixo com poucos e com muitos registros', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    await moscasPorDescanso(small, 4);
    await moscasPorDescanso(big, 50);
    const put = await queriesOf(database, small, 'PUT', '/api/island/purchases/banco', compra('banco', 8));
    expect(await queriesOf(database, big, 'PUT', '/api/island/purchases/banco', compra('banco', 8))).toBe(put);
    // 2 de sessão + 5 leituras + o insert.
    expect(put).toBe(8);
    expect(await queriesOf(database, big, 'PUT', '/api/island/purchases/banco', compra('banco', 8))).toBe(7);
    const get = await queriesOf(database, small, 'GET', '/api/island/purchases');
    expect(await queriesOf(database, big, 'GET', '/api/island/purchases')).toBe(get);
    expect(get).toBe(3);
  });
});
