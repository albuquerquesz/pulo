import { DEFAULT_USER_METADATA } from '@pulo/core/domain/user-metadata';
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

const MIN = 60_000;
const day = (n: number) => new Date(Date.UTC(2026, 10, n));

/** Uma linha de cada tabela, mais `extra` registros de histórico (sessões, check ins, descansos e hábitos feitos). */
async function seed(user: TestUser, extra = 0) {
  const userId = user.id;
  const habit = await database.db.habit.create({ data: { userId, title: 'Ler', weekdays: [0, 1, 2], active: true }, select: { id: true } });
  await database.db.routineBlock.create({ data: { userId, weekday: 1, startMinutes: 540, durationMinutes: 30, kind: 'foco' } });
  await database.db.habitLog.create({ data: { userId, habitId: habit.id, date: day(16), doneAt: new Date(TEST_NOW) } });
  await database.db.focusSession.create({
    data: { userId, startedAt: new Date(TEST_NOW - 5 * MIN), plannedMinutes: 25, state: 'em_andamento' },
  });
  await database.db.restDay.create({ data: { userId, date: day(17) } });
  await database.db.weeklyProposal.create({
    data: { userId, weekStart: day(16), state: 'pendente', patternText: 'p', changes: [], origin: 'regra', createdAt: new Date(TEST_NOW) },
  });
  await database.db.mascotState.create({ data: { userId, phase: 2, careDays: 4, updatedAt: new Date(TEST_NOW) } });
  await database.db.islandPurchase.create({ data: { userId, item: 'banco', cost: 8, createdAt: new Date(TEST_NOW) } });
  const tasks = Array.from({ length: 1 + extra }, (_, i) => ({ id: `${userId}-t${i}`.slice(-60), number: i + 1 }));
  await database.db.task.createMany({
    data: tasks.map((t) => ({ ...t, userId, title: 't', status: 'afazer' as const, position: t.number, priority: 'normal' as const, tags: [], pomodorosEstimated: 0, createdAt: new Date(TEST_NOW) })),
  });
  await database.db.taskSubtask.createMany({ data: tasks.map((t) => ({ userId, taskId: t.id, title: 's', done: false, position: 1 })) });
  await database.db.focusSession.createMany({
    data: Array.from({ length: extra }, (_, i) => ({
      userId,
      startedAt: new Date(TEST_NOW - (i + 1) * 60 * MIN - 30 * MIN),
      endedAt: new Date(TEST_NOW - (i + 1) * 60 * MIN),
      plannedMinutes: 25,
      state: 'concluida' as const,
    })),
  });
  await database.db.restDay.createMany({ data: Array.from({ length: extra }, (_, i) => ({ userId, date: new Date(Date.UTC(2026, 0, 1 + i)) })) });
}

const RANGE = '?from=2026-01-01&to=2026-12-31';

describe('/api/sync', () => {
  it('exige sessão e valida o intervalo', async () => {
    expect((await h.app.request(`/api/sync${RANGE}`)).status).toBe(401);
    const me = await h.newUser();
    for (const bad of ['', '?from=2026-01-01', '?from=2026-12-31&to=2026-01-01', '?from=2020-01-01&to=2026-01-01']) {
      const res = await me.call('GET', `/api/sync${bad}`);
      expect(res.status, bad).toBe(400);
      expect((await res.json()).error).toBe('consulta_invalida');
    }
  });

  it('pessoa nova recebe tudo vazio e os metadados padrão', async () => {
    const me = await h.newUser();
    const body = await (await me.call('GET', `/api/sync${RANGE}`)).json();
    expect(body).toMatchObject({
      user: { id: me.id, image: null },
      metadata: DEFAULT_USER_METADATA,
      blocks: [],
      habits: [],
      habitLogs: [],
      sessions: [],
      restDays: [],
      proposals: [],
      goals: [],
      tasks: [],
      subtasks: [],
      islandPurchases: [],
      mascot: null,
      streak: { atual: 0, recorde: 0 },
      serverTime: TEST_NOW,
    });
  });

  it('devolve tudo da pessoa, filtrado pelo intervalo, com a sessão em andamento', async () => {
    const me = await h.newUser();
    await seed(me);
    const body = await (await me.call('GET', '/api/sync?from=2026-11-16&to=2026-11-22')).json();
    expect(body.blocks).toHaveLength(1);
    expect(body.habits).toHaveLength(1);
    expect(body.habitLogs).toEqual([expect.objectContaining({ date: '2026-11-16' })]);
    expect(body.sessions).toEqual([expect.objectContaining({ state: 'em_andamento' })]);
    expect(body.restDays).toEqual([{ date: '2026-11-17' }]);
    expect(body.proposals).toEqual([expect.objectContaining({ weekStart: '2026-11-16', changes: [] })]);
    expect(body.mascot).toEqual({ phase: 2, careDays: 4, updatedAt: TEST_NOW });
    expect(body.islandPurchases).toEqual([{ item: 'banco', cost: 8, createdAt: TEST_NOW }]);

    const outside = await (await me.call('GET', '/api/sync?from=2026-03-01&to=2026-03-31')).json();
    expect(outside).toMatchObject({ habitLogs: [], restDays: [] });
    expect(outside.sessions).toHaveLength(1);
    // A sequência olha todo o histórico, não só o intervalo: hábito em 16, descanso em 17.
    expect(outside.streak).toEqual(body.streak);
    expect(body.streak).toMatchObject({ recorde: 1 });
    expect(outside.blocks).toHaveLength(1);
    expect(outside.islandPurchases).toHaveLength(1);
  });

  it('isolamento: nunca devolve dados de outra pessoa', async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    await seed(a);
    const body = await (await b.call('GET', `/api/sync${RANGE}`)).json();
    expect(body).toMatchObject({ blocks: [], habits: [], habitLogs: [], sessions: [], restDays: [], proposals: [], islandPurchases: [], mascot: null });
    expect(body.user.id).toBe(b.id);
  });

  it('queries: número fixo com poucos e com muitos dados', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    await seed(small);
    await seed(big, 50);
    const one = await queriesOf(database, small, 'GET', `/api/sync${RANGE}`);
    expect(await queriesOf(database, big, 'GET', `/api/sync${RANGE}`)).toBe(one);
    // 2 de sessão + 18 leituras numa transação.
    expect(one).toBe(20);
  });
});
