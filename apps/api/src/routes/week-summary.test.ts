import { buildWeekSummary } from '@pulo/core/domain/week-summary';
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

const MIN = 60_000;
// Semana de 2026-11-16 (segunda) a 2026-11-22 (domingo). Instantes em UTC; São Paulo é UTC-3.
const at = (iso: string) => new Date(iso);
const summaryOf = async (user: TestUser, date: string) => (await (await user.call('GET', `/api/week-summary?date=${date}`)).json()).summary;

async function seed(userId: string, scale = 1) {
  const habit = await database.db.habit.create({ data: { userId, title: 'h', weekdays: [0, 1, 2], active: true }, select: { id: true } });
  await database.db.focusSession.createMany({
    data: Array.from({ length: scale }, (_, i) => {
      const end = new Date(at('2026-11-17T13:00:00Z').getTime() + i * 60 * MIN); // 10h em São Paulo, manhã
      return { userId, startedAt: new Date(end.getTime() - 25 * MIN), endedAt: end, plannedMinutes: 25, state: 'concluida' as const };
    }),
  });
  await database.db.checkIn.createMany({
    data: Array.from({ length: scale }, (_, i) => ({
      userId,
      date: new Date(Date.UTC(2026, 10, 16 + (i % 7))),
      period: 'manha' as const,
      energy: 1 + (i % 5),
      createdAt: at('2026-11-16T12:00:00Z'),
    })),
  });
  await database.db.restDay.createMany({ data: [{ userId, date: new Date(Date.UTC(2026, 10, 21)) }] });
  await database.db.habitLog.createMany({
    data: [{ userId, habitId: habit.id, date: new Date(Date.UTC(2026, 10, 18)), doneAt: at('2026-11-18T12:00:00Z') }],
  });
}

describe('/api/week-summary', () => {
  it('exige sessão e valida a data', async () => {
    expect((await h.app.request('/api/week-summary?date=2026-11-18')).status).toBe(401);
    const me = await h.newUser();
    expect((await me.call('GET', '/api/week-summary')).status).toBe(400);
    expect((await me.call('GET', '/api/week-summary?date=2026-13-01')).status).toBe(400);
  });

  it('é igual ao buildWeekSummary do core sobre os mesmos dados', async () => {
    const me = await h.newUser();
    await seed(me.id);
    const summary = await summaryOf(me, '2026-11-19');
    const expected = buildWeekSummary({
      weekStart: '2026-11-16',
      timeZone: 'America/Sao_Paulo',
      sessions: [{ id: 's', startedAt: at('2026-11-17T12:35:00Z').getTime(), endedAt: at('2026-11-17T13:00:00Z').getTime(), plannedMinutes: 25, state: 'concluida', pausedMs: 0 }],
      checkIns: [{ id: 'c', date: '2026-11-16', period: 'manha', energy: 1, createdAt: 0 }],
      restDays: [{ date: '2026-11-21' }],
      habitLogs: [{ habitId: 'h', date: '2026-11-18', doneAt: 0 }],
    });
    expect(summary).toEqual(expected);
    expect(summary).toMatchObject({ weekStart: '2026-11-16', weekEnd: '2026-11-22', totalSessions: 1, totalCheckIns: 1, restDays: 1, careDays: 2, daysWithRecord: 4 });
  });

  it('ignora o que está fora da semana e usa o fuso da pessoa', async () => {
    const saoPaulo = await h.newUser();
    const utc = await h.newUser({ timezone: 'UTC' });
    // 2026-11-23 05:30Z: 02:30 em São Paulo (ainda o dia lógico 22) e 05:30 em UTC (dia 23, outra semana).
    for (const user of [saoPaulo, utc]) {
      await database.db.focusSession.create({
        data: { userId: user.id, startedAt: at('2026-11-23T05:00:00Z'), endedAt: at('2026-11-23T05:30:00Z'), plannedMinutes: 25, state: 'concluida' },
      });
    }
    expect((await summaryOf(saoPaulo, '2026-11-18')).totalSessions).toBe(1);
    expect((await summaryOf(utc, '2026-11-18')).totalSessions).toBe(0);
    expect((await summaryOf(utc, '2026-11-25')).totalSessions).toBe(1);
  });

  it('isolamento: o resumo só enxerga os dados da própria pessoa', async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    await seed(a.id);
    expect(await summaryOf(b, '2026-11-18')).toMatchObject({ totalSessions: 0, totalCheckIns: 0, restDays: 0, daysWithRecord: 0 });
    expect((await summaryOf(a, '2026-11-18')).totalSessions).toBe(1);
  });

  it('queries: número fixo com poucos e com muitos dados', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    await seed(small.id);
    await seed(big.id, 50);
    const small1 = await queriesOf(database, small, 'GET', '/api/week-summary?date=2026-11-18');
    const big50 = await queriesOf(database, big, 'GET', '/api/week-summary?date=2026-11-18');
    expect(big50).toBe(small1);
    // 2 de sessão + 4 leituras da semana.
    expect(small1).toBe(6);
  });
});
