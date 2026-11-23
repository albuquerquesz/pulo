import { syncQuerySchema } from '@pulo/core/api/schemas';
import {
  checkInMapper,
  focusSessionMapper,
  habitLogMapper,
  habitMapper,
  mascotStateMapper,
  restDayMapper,
  routineBlockMapper,
  weeklyProposalMapper,
} from '@pulo/db';
import { Hono } from 'hono';
import { type AppEnv, type RouteDeps, queryParams, requireSession } from '../http';
import { dateFilter, sessionRangeWhere } from '../queries';
import {
  blockSelect,
  checkInSelect,
  habitLogSelect,
  habitSelect,
  mascotSelect,
  proposalSelect,
  restDaySelect,
  sessionSelect,
} from '../selects';

/** Tudo o que o app precisa para abrir: `/api/sync`. Oito leituras fixas numa transação, qualquer volume de dados. */
export function syncRoutes({ auth, db, now }: RouteDeps) {
  return new Hono<AppEnv>().use(requireSession(auth)).get('/', queryParams(syncQuerySchema), async (c) => {
    const { id: userId, name, email, image, metadata } = c.var.user;
    const range = c.req.valid('query');
    const date = dateFilter(range);

    const [blocks, habits, habitLogs, sessions, checkIns, restDays, proposals, mascot] = await db.$transaction([
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
      db.checkIn.findMany({ where: { userId, date }, select: checkInSelect, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] }),
      db.restDay.findMany({ where: { userId, date }, select: restDaySelect, orderBy: { date: 'asc' } }),
      db.weeklyProposal.findMany({ where: { userId }, select: proposalSelect, orderBy: { weekStart: 'desc' } }),
      db.mascotState.findUnique({ where: { userId }, select: mascotSelect }),
    ]);

    return c.json({
      user: { id: userId, name, email, image },
      metadata,
      blocks: blocks.map(routineBlockMapper.toDomain),
      habits: habits.map(habitMapper.toDomain),
      habitLogs: habitLogs.map(habitLogMapper.toDomain),
      sessions: sessions.map(focusSessionMapper.toDomain),
      checkIns: checkIns.map(checkInMapper.toDomain),
      restDays: restDays.map(restDayMapper.toDomain),
      proposals: proposals.map(weeklyProposalMapper.toDomain),
      mascot: mascot === null ? null : mascotStateMapper.toDomain(mascot),
      serverTime: now(),
    });
  });
}
