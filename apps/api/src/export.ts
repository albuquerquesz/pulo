import {
  type Db,
  focusSessionMapper,
  goalMapper,
  habitLogMapper,
  habitMapper,
  islandPurchaseMapper,
  mascotStateMapper,
  restDayMapper,
  roomPlacementMapper,
  routineBlockMapper,
  taskCommentMapper,
  taskEventMapper,
  taskMapper,
  taskSubtaskMapper,
  weeklyProposalMapper,
} from '@pulo/db';
import type { SessionUser } from './http';
import { listConnections } from './connections';
import {
  blockSelect,
  goalSelect,
  habitLogSelect,
  habitSelect,
  islandPurchaseSelect,
  mascotSelect,
  proposalSelect,
  restDaySelect,
  roomDecorSelect,
  sessionSelect,
  taskCommentSelect,
  taskEventSelect,
  taskSelect,
  taskSubtaskSelect,
} from './selects';

/** Versão do formato do arquivo exportado. Suba ao mudar o significado de um campo. */
export const EXPORT_VERSION = 1;

/**
 * Tudo da pessoa num JSON, sem recorte de datas. Nunca entram tokens, sessões de login, contas OAuth nem segredos:
 * cada leitura escolhe as colunas (`select`) e filtra pelo `userId` da sessão. Leituras fixas, qualquer volume.
 * Tabela nova com `userId` precisa entrar aqui (o teste de `data-export.test.ts` cobra).
 */
export async function exportData(db: Db, person: SessionUser, exportedAt: number) {
  const { id: userId, name, email, image, createdAt, metadata } = person;
  const where = { userId };
  const [blocks, habits, habitLogs, sessions, restDays, proposals, goals, tasks, subtasks, comments, events, taskCounter, purchases, roomDecor, joiaCredit, mascot] =
    await db.$transaction([
      db.routineBlock.findMany({ where, select: blockSelect, orderBy: [{ weekday: 'asc' }, { startMinutes: 'asc' }] }),
      db.habit.findMany({ where, select: habitSelect, orderBy: { id: 'asc' } }),
      db.habitLog.findMany({ where, select: habitLogSelect, orderBy: [{ date: 'asc' }, { habitId: 'asc' }] }),
      db.focusSession.findMany({ where, select: sessionSelect, orderBy: { startedAt: 'asc' } }),
      db.restDay.findMany({ where, select: restDaySelect, orderBy: { date: 'asc' } }),
      db.weeklyProposal.findMany({ where, select: proposalSelect, orderBy: { weekStart: 'asc' } }),
      db.goal.findMany({ where, select: goalSelect, orderBy: { createdAt: 'asc' } }),
      db.task.findMany({ where, select: taskSelect, orderBy: { number: 'asc' } }),
      db.taskSubtask.findMany({ where, select: taskSubtaskSelect, orderBy: [{ taskId: 'asc' }, { position: 'asc' }] }),
      db.taskComment.findMany({ where, select: taskCommentSelect, orderBy: { createdAt: 'asc' } }),
      db.taskEvent.findMany({ where, select: taskEventSelect, orderBy: { seq: 'asc' } }),
      db.taskCounter.findUnique({ where, select: { last: true } }),
      db.islandPurchase.findMany({ where, select: { ...islandPurchaseSelect, kind: true }, orderBy: { createdAt: 'asc' } }),
      db.islandPurchase.findMany({
        where: { userId, kind: 'decoracao' },
        select: roomDecorSelect,
        orderBy: { createdAt: 'asc' },
        relationLoadStrategy: 'join',
      }),
      db.joiaCredit.findUnique({ where, select: { amount: true } }),
      db.mascotState.findUnique({ where, select: mascotSelect }),
    ]);
  const connections = await listConnections(db, userId);

  const purchasesOf = (kind: (typeof purchases)[number]['kind']) =>
    purchases.filter((p) => p.kind === kind).map(islandPurchaseMapper.toDomain);

  return {
    exportVersion: EXPORT_VERSION,
    exportedAt,
    user: { id: userId, name, email, image, createdAt },
    metadata,
    blocks: blocks.map(routineBlockMapper.toDomain),
    habits: habits.map(habitMapper.toDomain),
    habitLogs: habitLogs.map(habitLogMapper.toDomain),
    sessions: sessions.map(focusSessionMapper.toDomain),
    restDays: restDays.map(restDayMapper.toDomain),
    proposals: proposals.map(weeklyProposalMapper.toDomain),
    goals: goals.map(goalMapper.toDomain),
    tasks: tasks.map(taskMapper.toDomain),
    subtasks: subtasks.map(taskSubtaskMapper.toDomain),
    taskComments: comments.map(taskCommentMapper.toDomain),
    taskEvents: events.map(taskEventMapper.toDomain),
    lastTaskNumber: taskCounter?.last ?? 0,
    housePurchases: purchasesOf('casa'),
    roomDecor: roomDecor.map(roomPlacementMapper.toDomain),
    islandPurchases: purchasesOf('antiga'),
    joiaCredit: joiaCredit?.amount ?? 0,
    mascot: mascot === null ? null : mascotStateMapper.toDomain(mascot),
    connections,
  };
}
