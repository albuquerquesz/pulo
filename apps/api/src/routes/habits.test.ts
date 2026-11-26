import { MAX_HABITS_PER_DAY } from '@pulo/core/config/decisions';
import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { createHarness, queriesOf } from '../testing';

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
/** O corpo que um hábito tem na resposta: `active` acompanha o `state`. */
const habit = (id: string, extra: Record<string, unknown> = {}) => {
  const body = { id, title: 'Beber água', weekdays: [0, 2], active: true, ...extra };
  return { state: body.active === false ? 'arquivado' : 'ativo', ...body };
};

describe('/api/habits', () => {
  it('exige sessão', async () => {
    expect((await h.app.request('/api/habits')).status).toBe(401);
    expect((await h.app.request(`/api/habits/${uuid()}`, { method: 'PUT' })).status).toBe(401);
    expect((await h.app.request(`/api/habits/${uuid()}`, { method: 'DELETE' })).status).toBe(401);
  });

  it('cria, atualiza, lista e apaga com os registros', async () => {
    const me = await h.newUser();
    const id = uuid();
    const res = await me.call('PUT', `/api/habits/${id}`, habit(id, { weekdays: [2, 0, 2] }));
    expect(res.status).toBe(200);
    // Dias repetidos somem e ficam em ordem.
    expect(await res.json()).toEqual({ habit: habit(id, { weekdays: [0, 2] }) });

    await me.call('PUT', `/api/habits/${id}`, habit(id, { title: 'Alongar', active: false }));
    expect((await (await me.call('GET', '/api/habits')).json()).habits).toEqual([habit(id, { title: 'Alongar', active: false, weekdays: [0, 2] })]);

    await me.call('PUT', `/api/habits/${id}`, habit(id));
    await me.call('PUT', `/api/habit-logs/${id}/2026-11-16`, { habitId: id, date: '2026-11-16', doneAt: 1_794_000_000_000 });
    expect(await (await me.call('DELETE', `/api/habits/${id}`)).json()).toEqual({ deleted: 1 });
    expect((await (await me.call('GET', '/api/habit-logs')).json()).habitLogs).toEqual([]);
  });

  it(`aceita até ${MAX_HABITS_PER_DAY} hábitos ativos por dia e recusa o seguinte`, async () => {
    const me = await h.newUser();
    const ids = Array.from({ length: MAX_HABITS_PER_DAY }, uuid);
    for (const id of ids) expect((await me.call('PUT', `/api/habits/${id}`, habit(id, { weekdays: [3] }))).status).toBe(200);

    const extra = uuid();
    const blocked = await me.call('PUT', `/api/habits/${extra}`, habit(extra, { weekdays: [3, 4] }));
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).error).toBe('limite_por_dia');

    // Outro dia, hábito inativo e edição de um existente passam.
    expect((await me.call('PUT', `/api/habits/${extra}`, habit(extra, { weekdays: [4] }))).status).toBe(200);
    const inactive = uuid();
    expect((await me.call('PUT', `/api/habits/${inactive}`, habit(inactive, { weekdays: [3], active: false }))).status).toBe(200);
    expect((await me.call('PUT', `/api/habits/${ids[0]}`, habit(ids[0], { weekdays: [3], title: 'Renomeado' }))).status).toBe(200);
    // Reativar o inativo estoura o limite do dia 3.
    const reactivate = await me.call('PUT', `/api/habits/${inactive}`, habit(inactive, { weekdays: [3] }));
    expect(reactivate.status).toBe(409);
  });

  it('o limite conta só os hábitos da própria pessoa', async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    for (let i = 0; i < MAX_HABITS_PER_DAY; i += 1) {
      const id = uuid();
      await a.call('PUT', `/api/habits/${id}`, habit(id, { weekdays: [5] }));
    }
    const id = uuid();
    expect((await b.call('PUT', `/api/habits/${id}`, habit(id, { weekdays: [5] }))).status).toBe(200);
  });

  it('valida título, dias e id', async () => {
    const me = await h.newUser();
    const id = uuid();
    for (const bad of [habit(id, { title: '   ' }), habit(id, { weekdays: [] }), habit(id, { weekdays: [7] }), habit(id, { active: 'sim' })]) {
      expect((await me.call('PUT', `/api/habits/${id}`, bad)).status).toBe(400);
    }
    expect((await me.call('PUT', `/api/habits/${uuid()}`, habit(id))).status).toBe(400);
  });

  it('isolamento: outra pessoa não lê, não sobrescreve e não apaga', async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    const id = uuid();
    await a.call('PUT', `/api/habits/${id}`, habit(id));

    expect((await (await b.call('GET', '/api/habits')).json()).habits).toEqual([]);
    const steal = await b.call('PUT', `/api/habits/${id}`, habit(id, { title: 'roubado' }));
    expect(steal.status).toBe(409);
    expect(await (await b.call('DELETE', `/api/habits/${id}`)).json()).toEqual({ deleted: 0 });
    expect((await (await a.call('GET', '/api/habits')).json()).habits).toEqual([habit(id)]);
  });

  it('queries: número fixo com 1 e com 50 hábitos', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    await database.db.habit.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({ userId: big.id, title: `h${i}`, weekdays: [i % 7], active: i % 2 === 0 })),
    });
    const id = uuid();
    await small.call('PUT', `/api/habits/${id}`, habit(id));

    const get = await queriesOf(database, small, 'GET', '/api/habits');
    expect(await queriesOf(database, big, 'GET', '/api/habits')).toBe(get);
    expect(get).toBe(3);

    const bigId = uuid();
    const put = await queriesOf(database, small, 'PUT', `/api/habits/${id}`, habit(id));
    expect(await queriesOf(database, big, 'PUT', `/api/habits/${bigId}`, habit(bigId, { weekdays: [6] }))).toBe(put);
    expect(put).toBe(4);

    const del = await queriesOf(database, small, 'DELETE', `/api/habits/${id}`);
    expect(await queriesOf(database, big, 'DELETE', `/api/habits/${bigId}`)).toBe(del);
    // 2 de sessão + o acerto do gelo (6 leituras) + o delete.
    expect(del).toBe(9);
  });
});
