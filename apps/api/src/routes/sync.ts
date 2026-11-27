import { syncQuerySchema } from '@pulo/core/api/schemas';
import { DAY_ROLLOVER_HOUR } from '@pulo/core/config/decisions';
import { computeAchievements } from '@pulo/core/domain/achievements';
import { situacaoDoDescanso } from '@pulo/core/domain/descanso';
import { resumoDoGelo } from '@pulo/core/domain/gelo';
import { streakToday } from '@pulo/core/domain/streak';
import { countPomodoros } from '@pulo/core/domain/tasks';
import {
  achievementMapper,
  focusSessionMapper,
  freezeUseMapper,
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
import { acertarGelos } from '../gelo';
import { habitFromRow } from '../habits';
import { type AppEnv, type RouteDeps, queryParams, requireSession } from '../http';
import { achievementSummaryFromRows, dateFilter, habitMarkRead, sessionRangeWhere, statsFromRows, streakFromRows, streakReads } from '../queries';
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

/** Tudo o que o app precisa para abrir: `/api/sync`. Vinte e duas leituras fixas numa transação, qualquer volume de dados. */
export function syncRoutes({ auth, db, now }: RouteDeps) {
  return new Hono<AppEnv>().use(requireSession(auth)).get('/', queryParams(syncQuerySchema), async (c) => {
    const { id: userId, name, email, image, createdAt, metadata } = c.var.user;
    const range = c.req.valid('query');
    const date = dateFilter(range);

    const [blocks, habits, habitLogs, sessions, restDays, proposals, goals, goalChests, tasks, subtasks, islandPurchases, housePurchases, roomDecor, joiaCredit, mascot, unlocked, gelos, habitMarks, habitDays, allSessions, allRestDays, freezeUses] =
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
      db.task.findMany({ where: { userId }, select: taskSelect, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
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
      db.mascotState.findUnique({ where: { userId }, select: { ...mascotSelect, geloResolvidoAte: true } }),
      db.achievement.findMany({ where: { userId }, select: achievementSelect }),
      db.islandPurchase.findMany({ where: { userId, kind: 'gelo' }, select: islandPurchaseSelect, orderBy: { createdAt: 'asc' } }),
      habitMarkRead(db, userId),
      ...streakReads(db, userId),
    ]);

    const serverTime = now();
    const lidas = { habitDays, sessions: allSessions, restDays: allRestDays, freezeUses };
    // Com as linhas já lidas: gasta o gelo dos dias fechados antes de montar a resposta.
    const acerto = await acertarGelos(db, c.var.user, serverTime, { ...lidas, gelosComprados: gelos.length, resolvido: mascot });
    const history = { ...lidas, freezeUses: acerto.freezeUses, casa: housePurchases };
    const streak = streakFromRows(metadata, serverTime, history);
    const { guardados, max, recentes } = resumoDoGelo(gelos.length, acerto.freezeUses.map(freezeUseMapper.toDomain));
    const restDates = allRestDays.map(restDayMapper.toDomain);
    const hoje = streakToday(serverTime, metadata.timezone, metadata.profile?.dayStartMinutes ?? DAY_ROLLOVER_HOUR * 60, [
      ...habitDays.map((day) => restDayMapper.toDomain(day).date),
      ...restDates.map((r) => r.date),
    ]);
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
      // Todo o histórico (não só o intervalo), das mesmas leituras da sequência.
      pomodoros: countPomodoros(allSessions.map(focusSessionMapper.toDomain)),
      islandPurchases: islandPurchases.map(islandPurchaseMapper.toDomain),
      housePurchases: housePurchases.map(islandPurchaseMapper.toDomain),
      roomDecor: roomDecor.map(roomPlacementMapper.toDomain),
      joiaCredit: joiaCredit?.amount ?? 0,
      mascot: mascot === null ? (acerto.mascot ?? null) : mascotStateMapper.toDomain(mascot),
      gelo: { guardados, max, recentes },
      gelosComprados: gelos.map(islandPurchaseMapper.toDomain),
      descanso: situacaoDoDescanso(hoje, restDates),
      streak,
      // Quase tudo já foi lido: só as gravadas e as marcações por hábito pedem leitura própria.
      achievements: computeAchievements(
        achievementSummaryFromRows(metadata, streak, {
          ...history,
          habitMarks,
          tarefasConcluidas: tasks.filter((task) => task.status === 'feito').length,
          goals,
          goalChests,
          joiaCredit,
          decoracoes: roomDecor.length,
        }),
        unlocked.map(achievementMapper.toDomain),
      ),
      // Sem query a mais: usa as mesmas leituras de todo o histórico da sequência.
      stats: statsFromRows(createdAt, habitDays.reduce((total, day) => total + day._count.habitId, 0), allSessions),
      serverTime,
    });
  });
}
