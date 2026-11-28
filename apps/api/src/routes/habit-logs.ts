import { dateRangeQuerySchema, habitLogParamSchema, habitLogSchema } from '@pulo/core/api/schemas';
import { validarDiaDoRegistro } from '@pulo/core/domain/habits';
import { dateKeyToDate, habitLogMapper, habitMapper } from '@pulo/db';
import { Hono } from 'hono';
import { unlockAchievements } from '../achievements';
import { acertarGeloDaPessoa } from '../gelo';
import {
  ApiError,
  type AppEnv,
  CLOCK_SKEW_MS,
  type RouteDeps,
  assertNotInFuture,
  jsonBody,
  pathParams,
  queryParams,
  requireMatch,
  requireSession,
} from '../http';
import { dateFilter } from '../queries';
import { habitLogSelect, habitSelect } from '../selects';

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
      const { id: userId, metadata } = c.var.user;
      const where = { habitId: log.habitId, date: dateKeyToDate(log.date), userId };
      // Uma marca por hábito e dia: repetir mantém a primeira, mesmo que o dia já não aceite uma nova.
      let row = await db.habitLog.findFirst({ where, select: habitLogSelect });
      if (row === null) {
        const habit = await db.habit.findFirst({ where: { id: log.habitId, userId }, select: { ...habitSelect, createdAt: true } });
        // Hábito de outra pessoa responde como inexistente.
        if (habit === null) throw new ApiError(404, 'referencia_inexistente', 'O hábito não existe.');
        const dia = validarDiaDoRegistro({
          habit: habitMapper.toDomain(habit),
          date: log.date,
          now: now() + CLOCK_SKEW_MS,
          timeZone: metadata.timezone,
          dayStartMinutes: metadata.profile?.dayStartMinutes,
          ...(habit.createdAt === null ? {} : { createdAt: habit.createdAt.getTime() }),
        });
        if (!dia.ok) throw new ApiError(409, dia.error.code, dia.error.message);
        // Duas marcas ao mesmo tempo: vale a primeira (INSERT ... ON CONFLICT DO NOTHING).
        await db.habitLog.createMany({ data: [habitLogMapper.fromDomain(userId, log)], skipDuplicates: true });
        row = await db.habitLog.findFirstOrThrow({ where, select: habitLogSelect });
      }
      const newAchievements = await unlockAchievements(db, c.var.user, now());
      return c.json({ habitLog: habitLogMapper.toDomain(row), newAchievements });
    })
    .delete('/:habitId/:date', pathParams(habitLogParamSchema), async (c) => {
      const { habitId, date } = c.req.valid('param');
      // Acerta o gelo antes de apagar: o gelo vê os dias como estavam.
      await acertarGeloDaPessoa(db, c.var.user, now());
      const { count } = await db.habitLog.deleteMany({ where: { userId: c.var.user.id, habitId, date: dateKeyToDate(date) } });
      return c.json({ deleted: count });
    });
}
