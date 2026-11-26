import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { type TestUser, createHarness, queriesOf } from '../testing';

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
const DONE_AT = 1_794_900_000_000;

async function newHabit(user: TestUser) {
  const id = uuid();
  await user.call('PUT', `/api/habits/${id}`, { id, title: 'Ler', weekdays: [0, 1, 2, 3, 4, 5, 6], active: true });
  return id;
}
const log = (habitId: string, date: string, doneAt = DONE_AT) => ({ habitId, date, doneAt });
const put = (user: TestUser, body: ReturnType<typeof log>) => user.call('PUT', `/api/habit-logs/${body.habitId}/${body.date}`, body);

describe('/api/habit-logs', () => {
  it('exige sessão', async () => {
    expect((await h.app.request('/api/habit-logs')).status).toBe(401);
    expect((await h.app.request(`/api/habit-logs/${uuid()}/2026-11-16`, { method: 'PUT' })).status).toBe(401);
    expect((await h.app.request(`/api/habit-logs/${uuid()}/2026-11-16`, { method: 'DELETE' })).status).toBe(401);
  });

  it('marca, mantém a primeira marca ao repetir, filtra por intervalo e desmarca', async () => {
    const me = await h.newUser();
    const habitId = await newHabit(me);
    expect(await (await put(me, log(habitId, '2026-11-16'))).json()).toEqual({ habitLog: log(habitId, '2026-11-16'), newAchievements: [] });
    // Repetir não troca o doneAt.
    expect(await (await put(me, log(habitId, '2026-11-16', DONE_AT + 5000))).json()).toEqual({ habitLog: log(habitId, '2026-11-16'), newAchievements: [] });
    await put(me, log(habitId, '2026-11-18'));
    await put(me, log(habitId, '2026-11-25'));

    const all = (await (await me.call('GET', '/api/habit-logs')).json()).habitLogs;
    expect(all.map((l: { date: string }) => l.date)).toEqual(['2026-11-16', '2026-11-18', '2026-11-25']);
    const week = (await (await me.call('GET', '/api/habit-logs?from=2026-11-16&to=2026-11-22')).json()).habitLogs;
    expect(week.map((l: { date: string }) => l.date)).toEqual(['2026-11-16', '2026-11-18']);

    expect(await (await me.call('DELETE', `/api/habit-logs/${habitId}/2026-11-16`)).json()).toEqual({ deleted: 1 });
    expect(await (await me.call('DELETE', `/api/habit-logs/${habitId}/2026-11-16`)).json()).toEqual({ deleted: 0 });
  });

  it('valida data, intervalo e caminho divergente', async () => {
    const me = await h.newUser();
    const habitId = await newHabit(me);
    expect((await me.call('PUT', `/api/habit-logs/${habitId}/2026-02-31`, log(habitId, '2026-02-31'))).status).toBe(400);
    const dateMismatch = await me.call('PUT', `/api/habit-logs/${habitId}/2026-11-17`, log(habitId, '2026-11-16'));
    expect((await dateMismatch.json()).error).toBe('data_divergente');
    const idMismatch = await me.call('PUT', `/api/habit-logs/${uuid()}/2026-11-16`, log(habitId, '2026-11-16'));
    expect((await idMismatch.json()).error).toBe('id_divergente');
    const future = await put(me, log(habitId, '2026-11-16', h.now() + 3_600_000));
    expect(future.status).toBe(400);
    expect((await future.json()).error).toBe('horario_no_futuro');
    const range = await me.call('GET', '/api/habit-logs?from=2026-11-20&to=2026-11-10');
    expect(range.status).toBe(400);
    expect((await range.json()).error).toBe('consulta_invalida');
    expect((await me.call('GET', '/api/habit-logs?from=ontem')).status).toBe(400);
  });

  it('hábito inexistente ou de outra pessoa dá 404 referencia_inexistente', async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    const habitOfA = await newHabit(a);
    for (const habitId of [uuid(), habitOfA]) {
      const res = await put(b, log(habitId, '2026-11-16'));
      expect(res.status).toBe(404);
      expect((await res.json()).error).toBe('referencia_inexistente');
    }
  });

  it('isolamento: outra pessoa não lê, não sobrescreve e não apaga', async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    const habitId = await newHabit(a);
    await put(a, log(habitId, '2026-11-16'));

    expect((await (await b.call('GET', '/api/habit-logs')).json()).habitLogs).toEqual([]);
    expect((await put(b, log(habitId, '2026-11-16', DONE_AT + 1))).status).toBe(404);
    expect(await (await b.call('DELETE', `/api/habit-logs/${habitId}/2026-11-16`)).json()).toEqual({ deleted: 0 });
    expect((await (await a.call('GET', '/api/habit-logs')).json()).habitLogs).toEqual([log(habitId, '2026-11-16')]);
  });

  it('queries: número fixo com 1 e com 50 registros', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    const smallHabit = await newHabit(small);
    const bigHabit = await newHabit(big);
    await put(small, log(smallHabit, '2026-11-16'));
    await database.db.habitLog.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({
        habitId: bigHabit,
        userId: big.id,
        date: new Date(Date.UTC(2026, 10, 1 + (i % 28))),
        doneAt: new Date(DONE_AT),
      })).filter((row, i, rows) => rows.findIndex((r) => r.date.getTime() === row.date.getTime()) === i),
    });

    // Grava o que o histórico já destrava, para a contagem abaixo não incluir o INSERT de uma conquista.
    await put(big, log(bigHabit, '2026-11-01'));

    const get = await queriesOf(database, small, 'GET', '/api/habit-logs?from=2026-11-01&to=2026-11-30');
    expect(await queriesOf(database, big, 'GET', '/api/habit-logs?from=2026-11-01&to=2026-11-30')).toBe(get);
    expect(get).toBe(3);
    const putCount = await queriesOf(database, small, 'PUT', `/api/habit-logs/${smallHabit}/2026-11-17`, log(smallHabit, '2026-11-17'));
    expect(await queriesOf(database, big, 'PUT', `/api/habit-logs/${bigHabit}/2026-12-01`, log(bigHabit, '2026-12-01'))).toBe(putCount);
    expect(putCount).toBe(12);
    const del = await queriesOf(database, small, 'DELETE', `/api/habit-logs/${smallHabit}/2026-11-17`);
    expect(await queriesOf(database, big, 'DELETE', `/api/habit-logs/${bigHabit}/2026-12-01`)).toBe(del);
    // 2 de sessão + o acerto do gelo (6 leituras) + o delete.
    expect(del).toBe(9);
  });
});
