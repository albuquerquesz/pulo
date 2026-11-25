import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { focusSessionMapper, habitLogMapper, habitMapper, islandPurchaseMapper, mascotStateMapper, routineBlockMapper, weeklyProposalMapper } from './mappers';
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
    await t.db.habit.create({ data: habitMapper.fromDomain('u-map', { id: 'h1', title: 'Alongar', weekdays: [0, 3], state: 'ativo' }) });
    await t.db.habitLog.create({ data: habitLogMapper.fromDomain('u-map', { habitId: 'h1', date: '2026-11-22', doneAt: 1000 }) });
    await t.db.mascotState.create({ data: mascotStateMapper.fromDomain('u-map', { phase: 2, careDays: 4, updatedAt: 3000 }) });
    await t.db.weeklyProposal.create({
      data: weeklyProposalMapper.fromDomain('u-map', {
        id: 'wp1', weekStart: '2026-11-23', state: 'pendente', patternText: 'texto', changes: [], origin: 'ia', createdAt: 4000,
      }),
    });

    expect(habitMapper.toDomain(await t.db.habit.findUniqueOrThrow({ where: { id: 'h1' } })).weekdays).toStrictEqual([0, 3]);
    expect(habitLogMapper.toDomain(await t.db.habitLog.findFirstOrThrow({ where: { userId: 'u-map' } }))).toStrictEqual({ habitId: 'h1', date: '2026-11-22', doneAt: 1000 });
    expect(mascotStateMapper.toDomain(await t.db.mascotState.findUniqueOrThrow({ where: { userId: 'u-map' } }))).toStrictEqual({ phase: 2, careDays: 4, updatedAt: 3000 });
    expect(weeklyProposalMapper.toDomain(await t.db.weeklyProposal.findUniqueOrThrow({ where: { id: 'wp1' } })).weekStart).toBe('2026-11-23');

    await t.db.islandPurchase.create({ data: islandPurchaseMapper.fromDomain('u-map', { item: 'banco', cost: 8, createdAt: 5000 }) });
    expect(islandPurchaseMapper.toDomain(await t.db.islandPurchase.findFirstOrThrow({ where: { userId: 'u-map' } }))).toStrictEqual({ item: 'banco', cost: 8, createdAt: 5000 });
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
      t.db.routineBlock.create({ data: { userId: 'u-check', weekday: 7, startMinutes: 0, durationMinutes: 25, kind: 'foco' } }),
      t.db.routineBlock.create({ data: { userId: 'u-check', weekday: 1, startMinutes: 0, durationMinutes: 4, kind: 'foco' } }),
      t.db.habit.create({ data: { userId: 'u-check', title: 'x', weekdays: [9] } }),
      t.db.mascotState.create({ data: { userId: 'u-check', phase: 5, careDays: 0, updatedAt: new Date() } }),
      t.db.goal.create({ data: { userId: 'u-check', title: 'x', state: 'concluida', milestones: [], createdAt: new Date() } }),
      t.db.goal.create({ data: { userId: 'u-check', title: 'x', state: 'ativa', milestones: {}, createdAt: new Date() } }),
      t.db.islandPurchase.create({ data: { userId: 'u-check', item: 'banco', cost: -1, createdAt: new Date() } }),
    ];
    for (const attempt of invalid) await expect(attempt).rejects.toThrow();
  });

  it('um registro por hábito e dia, um dia de descanso por data e uma compra por item', async () => {
    await createUser('u-uniq');
    await t.db.habit.create({ data: { id: 'hu', userId: 'u-uniq', title: 'x', weekdays: [1] } });
    const log = habitLogMapper.fromDomain('u-uniq', { habitId: 'hu', date: '2026-11-22', doneAt: 1 });
    await t.db.habitLog.create({ data: log });
    await expect(t.db.habitLog.create({ data: log })).rejects.toThrow();
    await t.db.restDay.create({ data: { userId: 'u-uniq', date: new Date('2026-11-22') } });
    await expect(t.db.restDay.create({ data: { userId: 'u-uniq', date: new Date('2026-11-22') } })).rejects.toThrow();
    const compra = islandPurchaseMapper.fromDomain('u-uniq', { item: 'banco', cost: 8, createdAt: 1 });
    await t.db.islandPurchase.create({ data: compra });
    await expect(t.db.islandPurchase.create({ data: compra })).rejects.toThrow();
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
    await t.db.islandPurchase.create({ data: { userId: 'u-del', item: 'banco', cost: 8, createdAt: new Date() } });
    await t.db.user.delete({ where: { id: 'u-del' } });
    expect(await t.db.habit.count({ where: { userId: 'u-del' } })).toBe(0);
    expect(await t.db.habitLog.count({ where: { userId: 'u-del' } })).toBe(0);
    expect(await t.db.mascotState.count({ where: { userId: 'u-del' } })).toBe(0);
    expect(await t.db.islandPurchase.count({ where: { userId: 'u-del' } })).toBe(0);
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

  it('tarefas: CHECKs, cascade e meta apagada solta o vínculo', async () => {
    await createUser('u-task');
    await createUser('u-task-2');
    await t.db.goal.create({ data: { id: 'g-task', userId: 'u-task', title: 'x', state: 'ativa', milestones: [], createdAt: new Date() } });
    const base = { title: 'x', status: 'afazer' as const, position: 1.5, priority: 'normal' as const, tags: ['a'], pomodorosEstimated: 0, createdAt: new Date() };
    await t.db.task.create({ data: { ...base, id: 'tk1', userId: 'u-task', goalId: 'g-task' } });
    await expect(t.db.task.create({ data: { ...base, userId: 'u-task', status: 'feito' } })).rejects.toThrow();
    await expect(t.db.taskSubtask.create({ data: { userId: 'u-task-2', taskId: 'tk1', title: 'x', done: false, position: 1 } })).rejects.toThrow();
    await t.db.taskSubtask.create({ data: { userId: 'u-task', taskId: 'tk1', title: 'x', done: false, position: 1 } });
    await t.db.taskComment.create({ data: { userId: 'u-task', taskId: 'tk1', body: 'x', createdAt: new Date() } });
    await t.db.taskEvent.create({ data: { userId: 'u-task', taskId: 'tk1', kind: 'criada', createdAt: new Date() } });

    await t.db.goal.delete({ where: { id: 'g-task' } });
    expect((await t.db.task.findUniqueOrThrow({ where: { id: 'tk1' } })).goalId).toBeNull();

    await t.db.user.delete({ where: { id: 'u-task' } });
    const where = { userId: 'u-task' };
    expect(await Promise.all([
      t.db.task.count({ where }),
      t.db.taskSubtask.count({ where }),
      t.db.taskComment.count({ where }),
      t.db.taskEvent.count({ where }),
    ])).toEqual([0, 0, 0, 0]);
  });
});
