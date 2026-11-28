import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { createHarness, TEST_NOW } from '../testing';

let database: TestDatabase;
let h: ReturnType<typeof createHarness>;

beforeAll(async () => {
  database = await createTestDatabase();
  h = createHarness(database);
});
afterAll(async () => {
  await database.close();
});

const day = (key: string) => new Date(`${key}T00:00:00.000Z`);

describe('gelo com um foco vencido ainda em andamento', () => {
  it('encerra no fim planejado antes de gastar, e o dia do foco não gasta gelo', async () => {
    const me = await h.newUser();
    await database.db.mascotState.create({
      data: { userId: me.id, phase: 1, careDays: 0, updatedAt: new Date(TEST_NOW), geloResolvidoAte: day('2026-11-15') },
    });
    await database.db.restDay.create({ data: { userId: me.id, date: day('2026-11-15') } });
    const inicio = new Date('2026-11-16T15:00:00.000Z');
    const id = crypto.randomUUID();
    await database.db.focusSession.create({
      data: { id, userId: me.id, startedAt: inicio, plannedMinutes: 25, state: 'em_andamento', pausedMs: 0 },
    });

    const { streak } = await (await me.call('GET', '/api/streak')).json();

    expect(streak.semana).toContainEqual({ date: '2026-11-16', estado: 'feito' });
    const sessao = await database.db.focusSession.findFirstOrThrow({ where: { userId: me.id, id } });
    expect(sessao).toMatchObject({ state: 'concluida', endedAt: new Date(inicio.getTime() + 25 * 60_000) });
    expect(await database.db.freezeUse.findMany({ where: { userId: me.id, date: day('2026-11-16') } })).toEqual([]);
  });
});
