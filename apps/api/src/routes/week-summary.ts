import { weekSummaryQuerySchema } from '@pulo/core/api/schemas';
import { weekEndOf, weekStartOf } from '@pulo/core/domain/day';
import { buildWeekSummary } from '@pulo/core/domain/week-summary';
import { checkInMapper, focusSessionMapper, habitLogMapper, restDayMapper } from '@pulo/db';
import { Hono } from 'hono';
import { type AppEnv, type RouteDeps, queryParams, requireSession } from '../http';
import { dateFilter, sessionRangeWhere } from '../queries';
import { checkInSelect, habitLogSelect, restDaySelect, sessionSelect } from '../selects';

/** Resumo da semana: `/api/week-summary`. Quatro leituras por intervalo e `buildWeekSummary` do core. */
export function weekSummaryRoutes({ auth, db }: RouteDeps) {
  return new Hono<AppEnv>().use(requireSession(auth)).get('/', queryParams(weekSummaryQuerySchema), async (c) => {
    const { id: userId, metadata } = c.var.user;
    const weekStart = weekStartOf(c.req.valid('query').date);
    const range = { from: weekStart, to: weekEndOf(weekStart) };
    const date = dateFilter(range);

    const [sessions, checkIns, restDays, habitLogs] = await db.$transaction([
      db.focusSession.findMany({ where: sessionRangeWhere(userId, range, metadata.timezone), select: sessionSelect }),
      db.checkIn.findMany({ where: { userId, date }, select: checkInSelect }),
      db.restDay.findMany({ where: { userId, date }, select: restDaySelect }),
      db.habitLog.findMany({ where: { userId, date }, select: habitLogSelect }),
    ]);

    const summary = buildWeekSummary({
      weekStart,
      timeZone: metadata.timezone,
      sessions: sessions.map(focusSessionMapper.toDomain),
      checkIns: checkIns.map(checkInMapper.toDomain),
      restDays: restDays.map(restDayMapper.toDomain),
      habitLogs: habitLogs.map(habitLogMapper.toDomain),
    });
    return c.json({ summary });
  });
}
