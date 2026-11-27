import { JOIAS } from '@pulo/core/config/decisions';
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
const goal = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: 'Maratona', state: 'ativa', milestones: [], createdAt: 1, ...extra });
const concluida = (id: string) => goal(id, { state: 'concluida', completedAt: 2 });
/** O corpo que um hábito tem na resposta: `active` acompanha o `state`. */
const habit = (id: string, extra: Record<string, unknown> = {}) => {
  const body = { id, title: 'Ler', weekdays: [0], active: true, ...extra };
  return { state: body.active === false ? 'arquivado' : 'ativo', ...body };
};

async function novaMeta(user: TestUser, body: (id: string) => object = goal) {
  const id = uuid();
  expect((await user.call('PUT', `/api/goals/${id}`, body(id))).status).toBe(200);
  return id;
}
const sync = async (user: TestUser) => (await user.call('GET', '/api/sync?from=2026-11-01&to=2026-11-30')).json();
const habitos = async (user: TestUser) => (await (await user.call('GET', '/api/habits')).json()).habits;
const erro = async (res: Response) => [res.status, (await res.json()).error];

describe('ícone e cor', () => {
  it('grava, devolve e mantém quando um cliente antigo não manda', async () => {
    const me = await h.newUser();
    const id = await novaMeta(me, (i) => goal(i, { icon: '🏃', color: 'foco' }));
    await me.call('PUT', `/api/goals/${id}`, goal(id, { title: 'Editada' }));
    expect((await sync(me)).goals).toEqual([goal(id, { title: 'Editada', icon: '🏃', color: 'foco' })]);
  });

  it('recusa hex, cor desconhecida e ícone longo', async () => {
    const me = await h.newUser();
    const id = uuid();
    for (const extra of [{ color: '#ff0000' }, { color: 'rosa' }, { icon: 'x'.repeat(17) }, { icon: '  ' }, { icon: 'a b' }]) {
      expect((await me.call('PUT', `/api/goals/${id}`, goal(id, extra))).status).toBe(400);
    }
  });
});

describe('POST /api/goals/:id/chest', () => {
  it('exige sessão', async () => {
    expect((await h.app.request(`/api/goals/${uuid()}/chest`, { method: 'POST', headers: { origin: 'http://localhost:3000' } })).status).toBe(401);
  });

  it('abre uma vez, e só então as joias contam', async () => {
    const me = await h.newUser();
    const id = await novaMeta(me, concluida);
    // Falta exatamente o prêmio da meta para o tapete. Concluída sem abrir, ela não paga.
    await database.db.joiaCredit.create({ data: { userId: me.id, amount: 20 - JOIAS.por.goalCompleted } });
    const compra = { item: 'tapete-redondo', cost: 20, createdAt: TEST_NOW, x: 0, y: 0, rotation: 0 };
    expect(await erro(await me.call('PUT', '/api/room/tapete-redondo', compra))).toEqual([409, 'joias_insuficientes']);

    const chest = { goalId: id, abertoEm: TEST_NOW, joias: JOIAS.por.goalCompleted };
    const res = await me.call('POST', `/api/goals/${id}/chest`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ chest, newAchievements: [] });
    expect(await erro(await me.call('POST', `/api/goals/${id}/chest`))).toEqual([409, 'bau_ja_aberto']);
    expect((await sync(me)).goalChests).toEqual([chest]);
    expect((await (await me.call('GET', '/api/goals')).json()).chests).toEqual([chest]);
    expect((await me.call('PUT', '/api/room/tapete-redondo', compra)).status).toBe(200);

    // Reabrir e concluir de novo não dá outro baú.
    await me.call('PUT', `/api/goals/${id}`, goal(id));
    expect(await erro(await me.call('POST', `/api/goals/${id}/chest`))).toEqual([409, 'meta_nao_concluida']);
    await me.call('PUT', `/api/goals/${id}`, concluida(id));
    expect(await erro(await me.call('POST', `/api/goals/${id}/chest`))).toEqual([409, 'bau_ja_aberto']);
  });

  it('duas aberturas ao mesmo tempo gravam um resgate só', async () => {
    const me = await h.newUser();
    const id = await novaMeta(me, concluida);
    const status = (await Promise.all([1, 2].map(() => me.call('POST', `/api/goals/${id}/chest`)))).map((r) => r.status);
    expect(status.sort()).toEqual([200, 409]);
    expect(await database.db.goalChest.count({ where: { userId: me.id } })).toBe(1);
  });

  it('meta ativa dá 409; inexistente ou de outra pessoa dá 404', async () => {
    const me = await h.newUser();
    const other = await h.newUser();
    const ativa = await novaMeta(me);
    expect(await erro(await me.call('POST', `/api/goals/${ativa}/chest`))).toEqual([409, 'meta_nao_concluida']);
    const dela = await novaMeta(other, concluida);
    expect(await erro(await me.call('POST', `/api/goals/${dela}/chest`))).toEqual([404, 'meta_inexistente']);
    expect(await erro(await me.call('POST', `/api/goals/${uuid()}/chest`))).toEqual([404, 'meta_inexistente']);
    expect(await database.db.goalChest.count({ where: { goalId: dela } })).toBe(0);
  });
});

describe('hábito atrelado', () => {
  it('atrela, mantém quando omitido, troca, solta e a meta apagada deixa o hábito', async () => {
    const me = await h.newUser();
    const [a, b] = [await novaMeta(me), await novaMeta(me)];
    const id = uuid();
    const put = async (extra: Record<string, unknown>) => (await (await me.call('PUT', `/api/habits/${id}`, habit(id, extra))).json()).habit;

    expect(await put({ goalId: a })).toEqual(habit(id, { goalId: a }));
    expect(await put({ title: 'Outro' })).toEqual(habit(id, { title: 'Outro', goalId: a }));
    expect(await put({ goalId: b })).toEqual(habit(id, { goalId: b }));
    expect(await put({ goalId: null })).toEqual(habit(id));
    await put({ goalId: a });
    await me.call('DELETE', `/api/goals/${a}`);
    expect(await habitos(me)).toEqual([habit(id)]);
    expect((await sync(me)).habits).toEqual([habit(id)]);
  });

  it('meta de outra pessoa devolve 404 e nada é gravado, também no lote', async () => {
    const me = await h.newUser();
    const other = await h.newUser();
    const dela = await novaMeta(other);
    const id = uuid();
    expect(await erro(await me.call('PUT', `/api/habits/${id}`, habit(id, { goalId: dela })))).toEqual([404, 'referencia_inexistente']);
    expect(await erro(await me.call('PUT', '/api/habits', { habits: [habit(id, { goalId: dela })] }))).toEqual([404, 'referencia_inexistente']);
    expect(await habitos(me)).toEqual([]);
  });

  it('no lote, cada hábito mantém, troca ou solta a meta', async () => {
    const me = await h.newUser();
    const meta = await novaMeta(me);
    const [fica, solta, entra] = [uuid(), uuid(), uuid()].sort();
    await me.call('PUT', '/api/habits', { habits: [habit(fica, { goalId: meta }), habit(solta, { goalId: meta }), habit(entra)] });
    const res = await me.call('PUT', '/api/habits', { habits: [habit(fica), habit(solta, { goalId: null }), habit(entra, { goalId: meta })] });
    const esperado = [habit(fica, { goalId: meta }), habit(solta), habit(entra, { goalId: meta })];
    expect((await res.json()).habits).toEqual(esperado);
    expect(await habitos(me)).toEqual(esperado);
  });
});

describe('queries', () => {
  async function com(n: number) {
    const user = await h.newUser();
    const ids = Array.from({ length: n }, uuid);
    await database.db.goal.createMany({ data: ids.map((id) => ({ id, userId: user.id, title: 'x', state: 'concluida' as const, milestones: [], createdAt: new Date(1), completedAt: new Date(2) })) });
    await database.db.goalChest.createMany({ data: ids.slice(1).map((goalId) => ({ userId: user.id, goalId, abertoEm: new Date(2), joias: 10 })) });
    await database.db.habit.createMany({ data: ids.map((goalId) => ({ id: uuid(), userId: user.id, title: 'x', weekdays: [], active: false, goalId })) });
    return { user, free: ids[0] };
  }

  it('número fixo com 1 ou 50 registros', async () => {
    const small = await com(1);
    const big = await com(50);
    const count = (who: typeof small, method: 'GET' | 'PUT' | 'POST', path: string, body?: unknown) => queriesOf(database, who.user, method, path, body);
    expect(await count(big, 'GET', '/api/goals')).toBe(await count(small, 'GET', '/api/goals'));
    expect(await count(big, 'POST', `/api/goals/${big.free}/chest`)).toBe(await count(small, 'POST', `/api/goals/${small.free}/chest`));
    const one = (who: typeof small) => {
      const id = uuid();
      return count(who, 'PUT', `/api/habits/${id}`, habit(id, { goalId: who.free }));
    };
    expect(await one(big)).toBe(await one(small));
    const batch = (who: typeof small, n: number) => count(who, 'PUT', '/api/habits', { habits: Array.from({ length: n }, () => habit(uuid(), { active: false, goalId: who.free })) });
    expect(await batch(big, 20)).toBe(await batch(small, 1));
  });
});
