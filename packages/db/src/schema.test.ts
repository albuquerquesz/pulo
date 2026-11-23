import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkInMapper, focusSessionMapper, habitLogMapper, habitMapper, mascotStateMapper, routineBlockMapper, weeklyProposalMapper } from './mappers';
import { type TestDatabase, createTestDatabase } from './testing';

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase();
});
afterAll(async () => {
  await t.close();
});

async function createUser(id: string) {
  const now = new Date();
  return t.db.user.create({ data: { id, name: id, email: `${id}@example.test`, emailVerified: true, createdAt: now, updatedAt: now } });
}

describe('schema do domínio no Postgres', () => {
  it('grava e lê as entidades pelos mapeadores', async () => {
    await createUser('u-map');
    await t.db.routineBlock.create({
      data: routineBlockMapper.fromDomain('u-map', { id: 'rb1', weekday: 1, startMinutes: 540, durationMinutes: 25, kind: 'foco' }),
    });
    await t.db.habit.create({ data: habitMapper.fromDomain('u-map', { id: 'h1', title: 'Alongar', weekdays: [0, 3], active: true }) });
    await t.db.habitLog.create({ data: habitLogMapper.fromDomain('u-map', { habitId: 'h1', date: '2026-11-22', doneAt: 1000 }) });
    await t.db.checkIn.create({ data: checkInMapper.fromDomain('u-map', { id: 'ci1', date: '2026-11-22', period: 'manha', energy: 5, createdAt: 2000 }) });
    await t.db.mascotState.create({ data: mascotStateMapper.fromDomain('u-map', { phase: 2, careDays: 4, updatedAt: 3000 }) });
    await t.db.weeklyProposal.create({
      data: weeklyProposalMapper.fromDomain('u-map', {
        id: 'wp1', weekStart: '2026-11-23', state: 'pendente', patternText: 'texto', changes: [], origin: 'ia', createdAt: 4000,
      }),
    });

    expect(habitMapper.toDomain(await t.db.habit.findUniqueOrThrow({ where: { id: 'h1' } })).weekdays).toStrictEqual([0, 3]);
    expect(habitLogMapper.toDomain(await t.db.habitLog.findFirstOrThrow({ where: { userId: 'u-map' } }))).toStrictEqual({ habitId: 'h1', date: '2026-11-22', doneAt: 1000 });
    expect(checkInMapper.toDomain(await t.db.checkIn.findUniqueOrThrow({ where: { id: 'ci1' } })).energy).toBe(5);
    expect(mascotStateMapper.toDomain(await t.db.mascotState.findUniqueOrThrow({ where: { userId: 'u-map' } }))).toStrictEqual({ phase: 2, careDays: 4, updatedAt: 3000 });
    expect(weeklyProposalMapper.toDomain(await t.db.weeklyProposal.findUniqueOrThrow({ where: { id: 'wp1' } })).weekStart).toBe('2026-11-23');
  });

  it('só permite uma sessão em andamento por pessoa', async () => {
    await createUser('u-foco');
    const base = { plannedMinutes: 25, pausedMs: 0 };
    await t.db.focusSession.create({ data: focusSessionMapper.fromDomain('u-foco', { id: 'f1', startedAt: 1000, state: 'em_andamento', ...base }) });
    await expect(
      t.db.focusSession.create({ data: focusSessionMapper.fromDomain('u-foco', { id: 'f2', startedAt: 2000, state: 'em_andamento', ...base }) }),
    ).rejects.toThrow();
    // Encerrada não conta, e outra pessoa pode ter a sua.
    await t.db.focusSession.create({ data: focusSessionMapper.fromDomain('u-foco', { id: 'f3', startedAt: 500, endedAt: 900, state: 'concluida', ...base }) });
    await createUser('u-foco-2');
    await t.db.focusSession.create({ data: focusSessionMapper.fromDomain('u-foco-2', { id: 'f4', startedAt: 2000, state: 'em_andamento', ...base }) });
  });

  it('recusa valores fora do domínio (CHECK)', async () => {
    await createUser('u-check');
    const invalid = [
      t.db.checkIn.create({ data: { userId: 'u-check', date: new Date('2026-11-22'), period: 'tarde', energy: 6, createdAt: new Date() } }),
      t.db.routineBlock.create({ data: { userId: 'u-check', weekday: 7, startMinutes: 0, durationMinutes: 25, kind: 'foco' } }),
      t.db.routineBlock.create({ data: { userId: 'u-check', weekday: 1, startMinutes: 0, durationMinutes: 4, kind: 'foco' } }),
      t.db.habit.create({ data: { userId: 'u-check', title: 'x', weekdays: [9] } }),
      t.db.mascotState.create({ data: { userId: 'u-check', phase: 5, careDays: 0, updatedAt: new Date() } }),
    ];
    for (const attempt of invalid) await expect(attempt).rejects.toThrow();
  });

  it('um registro por hábito e dia, e um dia de descanso por data', async () => {
    await createUser('u-uniq');
    await t.db.habit.create({ data: { id: 'hu', userId: 'u-uniq', title: 'x', weekdays: [1] } });
    const log = habitLogMapper.fromDomain('u-uniq', { habitId: 'hu', date: '2026-11-22', doneAt: 1 });
    await t.db.habitLog.create({ data: log });
    await expect(t.db.habitLog.create({ data: log })).rejects.toThrow();
    await t.db.restDay.create({ data: { userId: 'u-uniq', date: new Date('2026-11-22') } });
    await expect(t.db.restDay.create({ data: { userId: 'u-uniq', date: new Date('2026-11-22') } })).rejects.toThrow();
  });

  it('o log de hábito não aponta para hábito de outra pessoa', async () => {
    await createUser('u-a');
    await createUser('u-b');
    await t.db.habit.create({ data: { id: 'h-de-a', userId: 'u-a', title: 'x', weekdays: [1] } });
    await expect(
      t.db.habitLog.create({ data: habitLogMapper.fromDomain('u-b', { habitId: 'h-de-a', date: '2026-11-22', doneAt: 1 }) }),
    ).rejects.toThrow();
  });

  it('apagar a pessoa apaga todos os dados dela (cascade)', async () => {
    await createUser('u-del');
    await t.db.habit.create({ data: { id: 'hd', userId: 'u-del', title: 'x', weekdays: [1] } });
    await t.db.habitLog.create({ data: habitLogMapper.fromDomain('u-del', { habitId: 'hd', date: '2026-11-22', doneAt: 1 }) });
    await t.db.mascotState.create({ data: { userId: 'u-del', phase: 1, careDays: 0, updatedAt: new Date() } });
    await t.db.user.delete({ where: { id: 'u-del' } });
    expect(await t.db.habit.count({ where: { userId: 'u-del' } })).toBe(0);
    expect(await t.db.habitLog.count({ where: { userId: 'u-del' } })).toBe(0);
    expect(await t.db.mascotState.count({ where: { userId: 'u-del' } })).toBe(0);
  });

  it('apagar o bloco mantém a sessão de foco, sem bloco', async () => {
    await createUser('u-bloco');
    await t.db.routineBlock.create({ data: { id: 'rb-del', userId: 'u-bloco', weekday: 1, startMinutes: 60, durationMinutes: 25, kind: 'foco' } });
    await t.db.focusSession.create({
      data: focusSessionMapper.fromDomain('u-bloco', { id: 'fs-del', blockId: 'rb-del', startedAt: 1, endedAt: 2, plannedMinutes: 25, state: 'concluida', pausedMs: 0 }),
    });
    await t.db.routineBlock.delete({ where: { id: 'rb-del' } });
    expect((await t.db.focusSession.findUniqueOrThrow({ where: { id: 'fs-del' } })).blockId).toBeNull();
  });
});
