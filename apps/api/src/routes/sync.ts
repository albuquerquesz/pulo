import { syncQuerySchema } from '@pulo/core/api/schemas';
import { computeAchievements } from '@pulo/core/domain/achievements';
import {
  achievementMapper,
  focusSessionMapper,
  goalChestMapper,
  goalMapper,
  habitLogMapper,
 
  islandPurchaseMapper,
  mascotStateMapper,
  restDayMapper,
  roomPlacementMapper,
  routineBlockMapper,
  taskMapper,
  taskSubtaskMapper,
  weeklyProposalMapper,
} from '@pulo/db';
import { Hono } from 'hono';
import { habitFromRow } from '../habits';
import { type AppEnv, type RouteDeps, queryParams, requireSession } from '../http';
import { achievementSummaryFromRows, dateFilter, sessionRangeWhere, statsFromRows, streakFromRows, streakReads } from '../queries';
import {
  achievementSelect,
  blockSelect,
  goalChestSelect,
  goalSelect,
  habitLogSelect,
  habitSelect,
  islandPurchaseSelect,
  mascotSelect,
  proposalSelect,
  restDaySelect,
  roomDecorSelect,
  sessionSelect,
  taskSelect,
  taskSubtaskSelect,
} from '../selects';

/** Tudo o que o app precisa para abrir: `/api/sync`. Dezenove leituras fixas numa transação, qualquer volume de dados. */
export function syncRoutes({ auth, db, now }: RouteDeps) {
  return new Hono<AppEnv>().use(requireSession(auth)).get('/', queryParams(syncQuerySchema), async (c) => {
    const { id: userId, name, email, image, createdAt, metadata } = c.var.user;
    const range = c.req.valid('query');
    const date = dateFilter(range);

    const [blocks, habits, habitLogs, sessions, restDays, proposals, goals, goalChests, tasks, subtasks, islandPurchases, housePurchases, roomDecor, joiaCredit, mascot, unlocked, habitDays, allSessions, allRestDays] =
      await db.$transaction([
      db.routineBlock.findMany({
        where: { userId },
        select: blockSelect,
        orderBy: [{ weekday: 'asc' }, { startMinutes: 'asc' }],
      }),
      db.habit.findMany({ where: { userId }, select: habitSelect, orderBy: { id: 'asc' } }),
      db.habitLog.findMany({ where: { userId, date }, select: habitLogSelect, orderBy: [{ date: 'asc' }, { habitId: 'asc' }] }),
      db.focusSession.findMany({
        where: sessionRangeWhere(userId, range, metadata.timezone),
        select: sessionSelect,
        orderBy: { startedAt: 'asc' },
      }),
      db.restDay.findMany({ where: { userId, date }, select: restDaySelect, orderBy: { date: 'asc' } }),
      db.weeklyProposal.findMany({ where: { userId }, select: proposalSelect, orderBy: { weekStart: 'desc' } }),
      db.goal.findMany({ where: { userId }, select: goalSelect, orderBy: { createdAt: 'asc' } }),
      db.goalChest.findMany({ where: { userId }, select: goalChestSelect, orderBy: { abertoEm: 'asc' } }),
      db.task.findMany({ where: { userId }, select: taskSelect, orderBy: { number: 'asc' } }),
      db.taskSubtask.findMany({ where: { userId }, select: taskSubtaskSelect, orderBy: [{ position: 'asc' }, { id: 'asc' }] }),
      db.islandPurchase.findMany({ where: { userId, kind: 'antiga' }, select: islandPurchaseSelect, orderBy: { createdAt: 'asc' } }),
      db.islandPurchase.findMany({ where: { userId, kind: 'casa' }, select: islandPurchaseSelect, orderBy: { createdAt: 'asc' } }),
      db.islandPurchase.findMany({
        where: { userId, kind: 'decoracao' },
        select: roomDecorSelect,
        orderBy: { createdAt: 'asc' },
        relationLoadStrategy: 'join',
      }),
      db.joiaCredit.findUnique({ where: { userId }, select: { amount: true } }),
      db.mascotState.findUnique({ where: { userId }, select: mascotSelect }),
      db.achievement.findMany({ where: { userId }, select: achievementSelect }),
      ...streakReads(db, userId),
    ]);

    const serverTime = now();
    const history = { habitDays, sessions: allSessions, restDays: allRestDays, casa: housePurchases };
    const streak = streakFromRows(metadata, serverTime, history);
    return c.json({
      user: { id: userId, name, email, image },
      metadata,
      blocks: blocks.map(routineBlockMapper.toDomain),
      habits: habits.map(habitFromRow),
      habitLogs: habitLogs.map(habitLogMapper.toDomain),
      sessions: sessions.map(focusSessionMapper.toDomain),
      restDays: restDays.map(restDayMapper.toDomain),
      proposals: proposals.map(weeklyProposalMapper.toDomain),
      goals: goals.map(goalMapper.toDomain),
      goalChests: goalChests.map(goalChestMapper.toDomain),
      tasks: tasks.map(taskMapper.toDomain),
      subtasks: subtasks.map(taskSubtaskMapper.toDomain),
      islandPurchases: islandPurchases.map(islandPurchaseMapper.toDomain),
      housePurchases: housePurchases.map(islandPurchaseMapper.toDomain),
      roomDecor: roomDecor.map(roomPlacementMapper.toDomain),
      joiaCredit: joiaCredit?.amount ?? 0,
      mascot: mascot === null ? null : mascotStateMapper.toDomain(mascot),
      streak,
      // As partes da casa e o histórico já foram lidos: só as gravadas pedem uma leitura própria.
      achievements: computeAchievements(achievementSummaryFromRows(streak, history), unlocked.map(achievementMapper.toDomain)),
      // Sem query a mais: usa as mesmas leituras de todo o histórico da sequência.
      stats: statsFromRows(createdAt, habitDays.reduce((total, day) => total + day._count.habitId, 0), allSessions),
      serverTime,
    });
  });
}
