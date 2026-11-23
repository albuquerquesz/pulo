import { dateRangeQuerySchema, habitLogParamSchema, habitLogSchema } from '@pulo/core/api/schemas';
import { dateKeyToDate, habitLogMapper } from '@pulo/db';
import { Hono } from 'hono';
import {
  ApiError,
  type AppEnv,
  type RouteDeps,
  assertNotInFuture,
  jsonBody,
  pathParams,
  queryParams,
  requireMatch,
  requireSession,
} from '../http';
import { dateFilter } from '../queries';
import { habitLogSelect } from '../selects';

/** Hábitos feitos: `/api/habit-logs`. */
export function habitLogRoutes({ auth, db, now }: RouteDeps) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/', queryParams(dateRangeQuerySchema), async (c) => {
      const date = dateFilter(c.req.valid('query'));
      const rows = await db.habitLog.findMany({
        where: { userId: c.var.user.id, ...(date ? { date } : {}) },
        select: habitLogSelect,
        orderBy: [{ date: 'asc' }, { habitId: 'asc' }],
      });
      return c.json({ habitLogs: rows.map(habitLogMapper.toDomain) });
    })
    .put('/:habitId/:date', pathParams(habitLogParamSchema), jsonBody(habitLogSchema), async (c) => {
      const log = c.req.valid('json');
      const params = c.req.valid('param');
      requireMatch(params.habitId, log.habitId, 'id_divergente');
      requireMatch(params.date, log.date, 'data_divergente');
      assertNotInFuture(log.doneAt, now(), 'doneAt');
      const userId = c.var.user.id;
      // Uma marca por hábito e dia: repetir mantém a primeira (INSERT ... ON CONFLICT DO NOTHING).
      // Hábito inexistente falha na chave estrangeira composta (habitId, userId) e vira 404.
      await db.habitLog.createMany({ data: [habitLogMapper.fromDomain(userId, log)], skipDuplicates: true });
      // Se a marca existente é de outra pessoa (hábito alheio), ela não aparece aqui: responde como inexistente.
      const row = await db.habitLog.findFirst({
        where: { habitId: log.habitId, date: dateKeyToDate(log.date), userId },
        select: habitLogSelect,
      });
      if (row === null) throw new ApiError(404, 'referencia_inexistente', 'O hábito não existe.');
      return c.json({ habitLog: habitLogMapper.toDomain(row) });
    })
    .delete('/:habitId/:date', pathParams(habitLogParamSchema), async (c) => {
      const { habitId, date } = c.req.valid('param');
      const { count } = await db.habitLog.deleteMany({ where: { userId: c.var.user.id, habitId, date: dateKeyToDate(date) } });
      return c.json({ deleted: count });
    });
}
