import { GOALS } from '@pulo/core/config/decisions';
import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { TEST_NOW, createHarness, queriesOf } from '../testing';

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
const goal = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: 'Correr uma maratona',
  why: 'saúde',
  targetDate: '2027-06-01',
  state: 'ativa',
  milestones: [{ id: 'm1', title: '5 km', doneAt: TEST_NOW - 5 }, { id: 'm2', title: '10 km' }],
  createdAt: TEST_NOW - 9,
  ...extra,
});

describe('/api/goals', () => {
  it('exige sessão', async () => {
    expect((await h.app.request('/api/goals')).status).toBe(401);
    expect((await h.app.request(`/api/goals/${uuid()}`, { method: 'PUT' })).status).toBe(401);
    expect((await h.app.request(`/api/goals/${uuid()}`, { method: 'DELETE' })).status).toBe(401);
  });

  it('cria, atualiza, lista, aparece no sync e apaga', async () => {
    const me = await h.newUser();
    const id = uuid();
    const res = await me.call('PUT', `/api/goals/${id}`, goal(id));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ goal: goal(id), newAchievements: [] });

    const done = goal(id, { state: 'concluida', completedAt: TEST_NOW - 1, why: undefined, targetDate: undefined });
    await me.call('PUT', `/api/goals/${id}`, done);
    const { why: _why, targetDate: _target, ...semOpcionais } = done;
    expect((await (await me.call('GET', '/api/goals')).json()).goals).toEqual([semOpcionais]);
    expect((await (await me.call('GET', '/api/sync?from=2026-11-01&to=2026-11-30')).json()).goals).toEqual([semOpcionais]);

    expect(await (await me.call('DELETE', `/api/goals/${id}`)).json()).toEqual({ deleted: 1 });
    expect((await (await me.call('GET', '/api/goals')).json()).goals).toEqual([]);
  });

  it(`aceita até ${GOALS.maxActive} ativas; concluídas não contam`, async () => {
    const me = await h.newUser();
    const ids = Array.from({ length: GOALS.maxActive }, uuid);
    for (const id of ids) expect((await me.call('PUT', `/api/goals/${id}`, goal(id))).status).toBe(200);

    const extra = uuid();
    const blocked = await me.call('PUT', `/api/goals/${extra}`, goal(extra));
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).error).toBe('limite_de_metas');

    // Meta nova não nasce concluída (concluir não pode ser um jeito de criar sem fim).
    const nascida = await me.call('PUT', `/api/goals/${extra}`, goal(extra, { state: 'concluida', completedAt: TEST_NOW }));
    expect((await nascida.json()).error).toBe('meta_criada_concluida');
    expect((await me.call('PUT', `/api/goals/${ids[0]}`, goal(ids[0], { title: 'Editada' }))).status).toBe(200);
    expect((await me.call('PUT', `/api/goals/${ids[0]}`, goal(ids[0], { state: 'concluida', completedAt: TEST_NOW }))).status).toBe(200);
    expect((await me.call('PUT', `/api/goals/${extra}`, goal(extra))).status).toBe(200);
  });

  it('valida título, estado, marcos e id', async () => {
    const me = await h.newUser();
    const id = uuid();
    const tooMany = Array.from({ length: GOALS.maxMilestones + 1 }, (_, i) => ({ id: `m${i}`, title: 'x' }));
    const invalid = [
      goal(id, { title: '  ' }),
      goal(id, { state: 'pausada' }),
      goal(id, { completedAt: 3 }),
      goal(id, { state: 'concluida' }),
      goal(id, { targetDate: '2027-02-31' }),
      goal(id, { milestones: tooMany }),
      goal(id, { milestones: [{ id: 'm1', title: 'a' }, { id: 'm1', title: 'b' }] }),
    ];
    for (const bad of invalid) expect((await me.call('PUT', `/api/goals/${id}`, bad)).status).toBe(400);
    expect((await me.call('PUT', `/api/goals/${uuid()}`, goal(id))).status).toBe(400);
  });

  it('recusa datas fora do razoável e guarda o createdAt da primeira gravação', async () => {
    const me = await h.newUser();
    const id = uuid();
    const antigas = [
      goal(id, { createdAt: 1 }),
      goal(id, { milestones: [{ id: 'm1', title: 'a', doneAt: 5 }] }),
      goal(id, { targetDate: '2999-01-01' }),
      goal(id, { targetDate: '2020-01-01' }),
    ];
    for (const bad of antigas) {
      const res = await me.call('PUT', `/api/goals/${id}`, bad);
      expect([res.status, (await res.json()).error]).toEqual([409, 'data_da_meta_invalida']);
    }
    await me.call('PUT', `/api/goals/${id}`, goal(id));
    const editada = await me.call('PUT', `/api/goals/${id}`, goal(id, { createdAt: 1 }));
    expect((await editada.json()).goal.createdAt).toBe(TEST_NOW - 9);
  });

  it('isolamento: outra pessoa não lê, não sobrescreve e não apaga', async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    const id = uuid();
    await a.call('PUT', `/api/goals/${id}`, goal(id));

    expect((await (await b.call('GET', '/api/goals')).json()).goals).toEqual([]);
    expect((await b.call('PUT', `/api/goals/${id}`, goal(id, { title: 'roubado' }))).status).toBe(409);
    expect(await (await b.call('DELETE', `/api/goals/${id}`)).json()).toEqual({ deleted: 0 });
    expect((await (await a.call('GET', '/api/goals')).json()).goals).toEqual([goal(id)]);
  });

  it('queries: número fixo com 1 e com muitas metas', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    await database.db.goal.createMany({
      data: Array.from({ length: 30 }, (_, i) => ({ userId: big.id, title: `g${i}`, state: 'concluida' as const, milestones: [], createdAt: new Date(i), completedAt: new Date(i) })),
    });
    const id = uuid();
    await small.call('PUT', `/api/goals/${id}`, goal(id));
    const get = await queriesOf(database, small, 'GET', '/api/goals');
    expect(await queriesOf(database, big, 'GET', '/api/goals')).toBe(get);
    expect(get).toBe(4);

    const bigId = uuid();
    // Grava o que o histórico já destrava, para a contagem abaixo não incluir o INSERT de uma conquista.
    await big.call('PUT', `/api/goals/${bigId}`, goal(bigId));
    const put = await queriesOf(database, small, 'PUT', `/api/goals/${id}`, goal(id));
    expect(await queriesOf(database, big, 'PUT', `/api/goals/${bigId}`, goal(bigId))).toBe(put);
    // 5 da escrita + 14 leituras das conquistas (a meta do teste tem marco riscado).
    expect(put).toBe(19);
    expect(await queriesOf(database, small, 'DELETE', `/api/goals/${id}`)).toBe(3);
  });
});
