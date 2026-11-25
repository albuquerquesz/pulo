import { addDays, dateKeyOf, startOfLogicalDay } from '@pulo/core/domain/day';
import { dateKeyToDate } from '@pulo/db';
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

const TZ = 'America/Sao_Paulo';
const HOUR = 3_600_000;
const today = dateKeyOf(TEST_NOW, TZ);
const ago = (n: number) => addDays(today, -n);

async function habitOn(user: TestUser, ...dates: string[]) {
  const userId = user.id;
  const habit = await database.db.habit.create({ data: { userId, title: 'Ler', weekdays: [0], active: true }, select: { id: true } });
  await database.db.habitLog.createMany({
    data: dates.map((date) => ({ userId, habitId: habit.id, date: dateKeyToDate(date), doneAt: new Date(TEST_NOW) })),
  });
}

/** Um foco concluído `hour` horas depois do começo do dia lógico do app. */
async function focusOn(user: TestUser, date: string, hour = 8) {
  const startedAt = startOfLogicalDay(date, TZ) + hour * HOUR;
  await database.db.focusSession.create({
    data: { userId: user.id, startedAt: new Date(startedAt), endedAt: new Date(startedAt + HOUR / 2), plannedMinutes: 30, state: 'concluida' },
  });
}

const restOn = (user: TestUser, date: string) => database.db.restDay.create({ data: { userId: user.id, date: dateKeyToDate(date) } });

const read = async (user: TestUser) => (await (await user.call('GET', '/api/streak')).json()).streak;

describe('/api/streak', () => {
  it('exige sessão', async () => {
    expect((await h.app.request('/api/streak')).status).toBe(401);
  });

  it('soma hábito e foco, atravessa o descanso e guarda o recorde', async () => {
    const me = await h.newUser();
    await habitOn(me, ago(1), ago(20), ago(21), ago(22), ago(23));
    await restOn(me, ago(2));
    await focusOn(me, ago(3));
    const streak = await read(me);
    expect(streak).toMatchObject({ atual: 2, recorde: 4 });
    expect(streak.semana).toHaveLength(7);
    expect(streak.semana).toContainEqual({ date: today, estado: 'hoje' });
  });

  it('o /api/sync devolve a mesma sequência', async () => {
    const me = await h.newUser();
    await habitOn(me, today);
    const body = await (await me.call('GET', `/api/sync?from=${today}&to=${today}`)).json();
    expect(body.streak).toEqual(await read(me));
    expect(body.streak.atual).toBe(1);
  });

  it('usa o fuso e o começo do dia da pessoa', async () => {
    // Foco que começa às 8h do app (4h) em São Paulo, ou seja, termina às 12h30.
    const profile = { frogName: 'Pulo', dayStartMinutes: 13 * 60, dayEndMinutes: 22 * 60, createdAt: 1 };
    const early = await h.newUser({ timezone: TZ });
    const late = await h.newUser({ timezone: TZ, profile });
    await focusOn(early, ago(1));
    await focusOn(late, ago(1));
    const doneDate = async (user: TestUser) =>
      (await read(user)).semana.find((d: { estado: string }) => d.estado === 'feito')?.date;
    expect(await doneDate(early)).toBe(ago(1));
    expect(await doneDate(late)).toBe(ago(2));
  });

  it('isolamento: nunca conta registros de outra pessoa', async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    await habitOn(a, today);
    expect(await read(b)).toMatchObject({ atual: 0, recorde: 0 });
  });

  it('queries: número fixo com 1 e com 50 registros', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    for (const [user, size] of [
      [small, 1],
      [big, 50],
    ] as const) {
      const dates = Array.from({ length: size }, (_, i) => ago(i));
      await habitOn(user, ...dates);
      for (const date of dates) {
        await restOn(user, date);
        await focusOn(user, date);
      }
    }
    const one = await queriesOf(database, small, 'GET', '/api/streak');
    expect(await queriesOf(database, big, 'GET', '/api/streak')).toBe(one);
    // 2 de sessão + 3 leituras numa transação.
    expect(one).toBe(5);
  });
});
