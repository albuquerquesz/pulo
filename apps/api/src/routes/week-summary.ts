import { weekSummaryQuerySchema } from '@pulo/core/api/schemas';
import { weekStartOf } from '@pulo/core/domain/day';
import { Hono } from 'hono';
import { type AppEnv, type RouteDeps, queryParams, requireSession } from '../http';
import { summaryFromRows, weekSummaryReads } from '../queries';

/** Resumo da semana: `/api/week-summary`. Quatro leituras por intervalo e `buildWeekSummary` do core. */
export function weekSummaryRoutes({ auth, db }: RouteDeps) {
  return new Hono<AppEnv>().use(requireSession(auth)).get('/', queryParams(weekSummaryQuerySchema), async (c) => {
    const { id: userId, metadata } = c.var.user;
    const weekStart = weekStartOf(c.req.valid('query').date);
    const [sessions, restDays, habitLogs] = await db.$transaction([
      ...weekSummaryReads(db, userId, metadata.timezone, weekStart),
    ]);
    return c.json({ summary: summaryFromRows(weekStart, metadata.timezone, { sessions, restDays, habitLogs }) });
  });
}
