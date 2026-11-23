import { MAX_HABITS_PER_DAY } from '@pulo/core/config/decisions';
import { habitSchema, idParamSchema } from '@pulo/core/api/schemas';
import type { Weekday } from '@pulo/core/domain/types';
import { Prisma, habitMapper } from '@pulo/db';
import { Hono } from 'hono';
import { ApiError, type AppEnv, type RouteDeps, jsonBody, pathParams, requireMatch, requireSession } from '../http';
import { habitSelect } from '../selects';

/** Hábitos: `/api/habits`. */
export function habitRoutes({ auth, db }: RouteDeps) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/', async (c) => {
      const rows = await db.habit.findMany({ where: { userId: c.var.user.id }, select: habitSelect, orderBy: { id: 'asc' } });
      return c.json({ habits: rows.map(habitMapper.toDomain) });
    })
    .put('/:id', pathParams(idParamSchema), jsonBody(habitSchema), async (c) => {
      const habit = c.req.valid('json');
      requireMatch(c.req.valid('param').id, habit.id, 'id_divergente');
      const userId = c.var.user.id;
      const weekdays = [...new Set(habit.weekdays)].sort((a, b) => a - b);
      const data = habitMapper.fromDomain(userId, { ...habit, weekdays });
      const { id: _id, userId: _owner, ...update } = data;

      // Leitura dos outros hábitos ativos e escrita na mesma transação serializável: duas escritas
      // simultâneas não passam juntas do limite por dia (a perdedora recebe 409 conflito_concorrente).
      const row = await db.$transaction(
        async (tx) => {
          if (habit.active) {
            const others = await tx.habit.findMany({
              where: { userId, active: true, id: { not: habit.id } },
              select: { weekdays: true },
            });
            const overLimit = weekdays.find(
              (weekday: Weekday) => others.filter((other) => other.weekdays.includes(weekday)).length >= MAX_HABITS_PER_DAY,
            );
            if (overLimit !== undefined) {
              throw new ApiError(409, 'limite_por_dia', `Um dia comporta até ${MAX_HABITS_PER_DAY} hábitos.`);
            }
          }
          return tx.habit.upsert({
            where: { id_userId: { id: habit.id, userId } },
            create: data,
            update,
            select: habitSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return c.json({ habit: habitMapper.toDomain(row) });
    })
    .delete('/:id', pathParams(idParamSchema), async (c) => {
      // Os registros do hábito saem junto (cascade no banco).
      const { count } = await db.habit.deleteMany({ where: { id: c.req.valid('param').id, userId: c.var.user.id } });
      return c.json({ deleted: count });
    });
}
