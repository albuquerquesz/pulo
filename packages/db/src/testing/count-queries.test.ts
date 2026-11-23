import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type TestDatabase, createTestDatabase } from './index';

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase();
  const now = new Date();
  await t.db.user.create({ data: { id: 'u1', name: 'u1', email: 'u1@example.test', emailVerified: true, createdAt: now, updatedAt: now } });
  for (let index = 0; index < 5; index++) {
    await t.db.habit.create({ data: { id: `h${index}`, userId: 'u1', title: `Hábito ${index}`, weekdays: [1] } });
    await t.db.habitLog.create({ data: { habitId: `h${index}`, userId: 'u1', date: new Date('2026-11-22'), doneAt: now } });
  }
});
afterAll(async () => {
  await t.close();
});

describe('countQueries', () => {
  it('conta as queries de um trecho e ignora o que ficou de fora', async () => {
    await t.db.habit.count();
    const { count, queries } = await t.countQueries(async () => {
      await t.db.habit.count();
      await t.db.habitLog.count();
    });
    expect(count).toBe(2);
    expect(queries).toHaveLength(2);
  });

  it('exemplo anti N+1: hábitos com logs em UMA query, não 1 + N', async () => {
    const naive = await t.countQueries(async () => {
      const habits = await t.db.habit.findMany({ where: { userId: 'u1' } });
      // Anti padrão: uma query por hábito dentro do loop.
      for (const habit of habits) await t.db.habitLog.findMany({ where: { habitId: habit.id } });
    });
    expect(naive.count).toBe(6);

    const joined = await t.countQueries(() =>
      t.db.habit.findMany({
        where: { userId: 'u1' },
        select: { id: true, title: true, logs: { select: { date: true, doneAt: true } } },
        relationLoadStrategy: 'join',
      }),
    );
    expect(joined.result).toHaveLength(5);
    expect(joined.result.every((habit) => habit.logs.length === 1)).toBe(true);
    expect(joined.count).toBe(1);
  });

  it('não conta BEGIN e COMMIT de transações', async () => {
    const { count } = await t.countQueries(() =>
      t.db.$transaction([t.db.habit.count({ where: { userId: 'u1' } }), t.db.habitLog.count({ where: { userId: 'u1' } })]),
    );
    expect(count).toBe(2);
  });

  it('recusa medições aninhadas', async () => {
    await expect(t.countQueries(() => t.countQueries(async () => 1))).rejects.toThrow(/aninhado/);
  });
});
