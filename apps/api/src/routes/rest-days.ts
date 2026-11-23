import { dateParamSchema, dateRangeQuerySchema } from '@pulo/core/api/schemas';
import { dateKeyToDate, restDayMapper } from '@pulo/db';
import { Hono } from 'hono';
import { type AppEnv, type RouteDeps, pathParams, queryParams, requireSession } from '../http';
import { dateFilter, refreshMascot } from '../queries';
import { restDaySelect } from '../selects';

/** Dias de descanso: `/api/rest-days`. Criar ou apagar um dia pode mudar os dias de cuidado, então atualiza o sapo. */
export function restDayRoutes({ auth, db, now }: RouteDeps) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/', queryParams(dateRangeQuerySchema), async (c) => {
      const date = dateFilter(c.req.valid('query'));
      const rows = await db.restDay.findMany({
        where: { userId: c.var.user.id, ...(date ? { date } : {}) },
        select: restDaySelect,
        orderBy: { date: 'asc' },
      });
      return c.json({ restDays: rows.map(restDayMapper.toDomain) });
    })
    .put('/:date', pathParams(dateParamSchema), async (c) => {
      const { id: userId, metadata } = c.var.user;
      const dateKey = c.req.valid('param').date;
      const date = dateKeyToDate(dateKey);
      const { restDay, mascot } = await db.$transaction(async (tx) => {
        // INSERT ... ON CONFLICT DO NOTHING: repetir é idempotente.
        await tx.restDay.createMany({ data: [{ userId, date }], skipDuplicates: true });
        return { restDay: { date: dateKey }, mascot: await refreshMascot(tx, userId, metadata.timezone, now()) };
      });
      return c.json({ restDay, mascot });
    })
    .delete('/:date', pathParams(dateParamSchema), async (c) => {
      const { id: userId, metadata } = c.var.user;
      const date = dateKeyToDate(c.req.valid('param').date);
      const { deleted, mascot } = await db.$transaction(async (tx) => {
        const { count } = await tx.restDay.deleteMany({ where: { userId, date } });
        return { deleted: count, mascot: await refreshMascot(tx, userId, metadata.timezone, now()) };
      });
      return c.json({ deleted, mascot });
    });
}
