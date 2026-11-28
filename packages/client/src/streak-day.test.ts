import { createHarness, TEST_NOW, TEST_ORIGIN } from '@pulo/api/src/testing';
import { DAY_MS } from '@pulo/core/domain/clock';
import { dateKeyOf, startOfLogicalDay, addDays } from '@pulo/core/domain/day';
import { DEFAULT_TIMEZONE } from '@pulo/core/config/decisions';
import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { createRemoteRepository } from './index';

let database: TestDatabase;
let h: ReturnType<typeof createHarness>;

beforeAll(async () => {
  database = await createTestDatabase();
  h = createHarness(database);
});
afterAll(async () => {
  await database.close();
});

const HORA = DAY_MS / 24;

describe('cache da sequência', () => {
  it('relê na virada do app e de novo no começo do dia da pessoa', async () => {
    const me = await h.newUser();
    let agora = TEST_NOW;
    const chamadas: string[] = [];
    const repo = await createRemoteRepository({
      baseUrl: 'http://api.test',
      clock: { now: () => agora },
      retries: 0,
      fetch: (request) => {
        chamadas.push(new URL(request.url).pathname);
        const headers = new Headers(request.headers);
        headers.set('cookie', me.cookie);
        headers.set('origin', TEST_ORIGIN);
        return h.app.fetch(new Request(request, { headers }));
      },
    });
    const user = await repo.getUser();
    await repo.saveUser({ id: me.id, frogName: 'Juca', timezone: DEFAULT_TIMEZONE, dayStartMinutes: 7 * 60, dayEndMinutes: 22 * 60, theme: 'sistema', reduceMotion: false, createdAt: user?.createdAt ?? TEST_NOW });
    const virada = startOfLogicalDay(addDays(dateKeyOf(TEST_NOW, DEFAULT_TIMEZONE), 1), DEFAULT_TIMEZONE);
    const pedidos = () => chamadas.filter((c) => c === '/api/streak').length;

    agora = virada + HORA;
    await repo.getStreak();
    await repo.getStreak();
    expect(pedidos()).toBe(1);

    agora = virada + 4 * HORA;
    await repo.getStreak();
    expect(pedidos()).toBe(2);
  });
});
