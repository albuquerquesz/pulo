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
const uuid = () => crypto.randomUUID();

/** Cria dados pela própria API, como o app faria, e devolve quantos registros de cada tipo existem. */
async function populate(user: TestUser, extra = 0) {
  const habitId = uuid();
  const blockId = uuid();
  const sessionId = uuid();
  await user.call('PUT', `/api/blocks/${blockId}`, { id: blockId, weekday: 0, startMinutes: 480, durationMinutes: 30, kind: 'foco' });
  await user.call('PUT', `/api/habits/${habitId}`, { id: habitId, title: 'Ler', weekdays: [0], active: true });
  await user.call('PUT', `/api/habit-logs/${habitId}/2026-11-16`, { habitId, date: '2026-11-16', doneAt: TEST_NOW });
  await user.call('PUT', `/api/sessions/${sessionId}`, {
    id: sessionId, blockId, startedAt: TEST_NOW - 30 * MIN, endedAt: TEST_NOW - 5 * MIN, plannedMinutes: 25, state: 'concluida', pausedMs: 0,
  });
  await user.call('PUT', '/api/rest-days/2026-11-18');
  const proposalId = uuid();
  await user.call('PUT', `/api/proposals/${proposalId}`, {
    id: proposalId, weekStart: '2026-11-23', state: 'pendente', patternText: 'p', changes: [], origin: 'regra', createdAt: TEST_NOW - 1,
  });
  await database.db.islandPurchase.create({ data: { userId: user.id, item: 'banco', cost: 8, createdAt: new Date(TEST_NOW - 1) } });
  await database.db.restDay.createMany({
    data: Array.from({ length: extra }, (_, i) => ({ userId: user.id, date: new Date(Date.UTC(2026, 0, 1 + i)) })),
  });
}

async function snapshot(user: TestUser) {
  const body = await (await user.call('GET', '/api/sync?from=2026-01-01&to=2026-12-31')).json();
  return {
    blocks: body.blocks.length,
    habits: body.habits.length,
    habitLogs: body.habitLogs.length,
    sessions: body.sessions.length,
    restDays: body.restDays.length,
    proposals: body.proposals.length,
    islandPurchases: body.islandPurchases.length,
    mascot: body.mascot,
  };
}

describe('DELETE /api/data', () => {
  it('exige sessão', async () => {
    expect((await h.app.request('/api/data', { method: 'DELETE' })).status).toBe(401);
  });

  it('apaga todo o progresso da pessoa e mantém a conta e os metadados', async () => {
    const me = await h.newUser();
    await populate(me);
    await me.call('PATCH', '/api/me/metadata', { theme: 'escuro' });
    expect(await snapshot(me)).toMatchObject({ blocks: 1, habits: 1, habitLogs: 1, sessions: 1, restDays: 1, proposals: 1, islandPurchases: 1 });

    const res = await me.call('DELETE', '/api/data');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      deleted: { sessions: 1, blocks: 1, habits: 1, restDays: 1, proposals: 1, goals: 0, islandPurchases: 1, mascot: 1, tasks: 0, achievements: 1, freezeUses: 0 },
    });
    expect(await snapshot(me)).toEqual({ blocks: 0, habits: 0, habitLogs: 0, sessions: 0, restDays: 0, proposals: 0, islandPurchases: 0, mascot: null });
    expect(await database.db.habitLog.count({ where: { userId: me.id } })).toBe(0);

    // A conta continua e o tema salvo também.
    const profile = await (await me.call('GET', '/api/me')).json();
    expect(profile.metadata.theme).toBe('escuro');
    // Apagar de novo não falha.
    expect((await (await me.call('DELETE', '/api/data')).json()).deleted).toMatchObject({ sessions: 0, blocks: 0 });
    // O progresso recomeça do zero.
    const sid = uuid();
    const again = await me.call('PUT', `/api/sessions/${sid}`, {
      id: sid, startedAt: TEST_NOW - 30 * MIN, endedAt: TEST_NOW - 5 * MIN, plannedMinutes: 25, state: 'concluida', pausedMs: 0,
    });
    expect((await again.json()).mascot).toMatchObject({ phase: 1, careDays: 1 });
  });

  it('isolamento: não apaga nada de outra pessoa', async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    await populate(a);
    await populate(b);
    const before = await snapshot(b);
    await a.call('DELETE', '/api/data');
    expect(await snapshot(b)).toEqual(before);
    expect(await snapshot(a)).toMatchObject({ blocks: 0, sessions: 0, mascot: null });
  });

  it('queries: número fixo com poucos e com muitos dados', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    await populate(small);
    await populate(big, 50);
    const one = await queriesOf(database, small, 'DELETE', '/api/data');
    expect(await queriesOf(database, big, 'DELETE', '/api/data')).toBe(one);
    // 2 de sessão + 12 deletes numa transação.
    expect(one).toBe(14);
  });
});
