import { MAX_HABITS_PER_DAY } from '@pulo/core/config/decisions';
import { habitInputSchema, habitsBatchSchema, idParamSchema } from '@pulo/core/api/schemas';
import type { Weekday } from '@pulo/core/domain/types';
import { Prisma, habitMapper, toWeekday } from '@pulo/db';
import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError, type AppEnv, type Client, type RouteDeps, jsonBody, pathParams, requireMatch, requireSession } from '../http';
import { habitSelect } from '../selects';

const returnedIds = z.array(z.object({ id: z.string() }));

/** As metas atreladas precisam ser da pessoa; a de outra responde como se não existisse. Uma query, e só quando há vínculo. */
async function assertOwnGoals(tx: Client, userId: string, goalIds: readonly (string | null | undefined)[]) {
  const ids = [...new Set(goalIds.filter((id) => typeof id === 'string'))];
  if (ids.length === 0) return;
  const owned = await tx.goal.count({ where: { userId, id: { in: ids } } });
  if (owned !== ids.length) throw new ApiError(404, 'referencia_inexistente', 'A meta não existe.');
}

/** Hábitos: `/api/habits`. `goalId` omitido mantém a meta gravada; `null` solta. */
export function habitRoutes({ auth, db }: RouteDeps) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/', async (c) => {
      const rows = await db.habit.findMany({ where: { userId: c.var.user.id }, select: habitSelect, orderBy: { id: 'asc' } });
      return c.json({ habits: rows.map(habitMapper.toDomain) });
    })
    // Lote (onboarding): as invariantes da rota de um hábito, para todos de uma vez, com um número fixo de queries
    // (ler os outros hábitos ativos, um INSERT ... SELECT unnest ... ON CONFLICT) numa transação serializável. Tudo ou nada.
    .put('/', jsonBody(habitsBatchSchema), async (c) => {
      const userId = c.var.user.id;
      const habits = c.req.valid('json').habits.map((habit) => ({
        ...habit,
        weekdays: [...new Set(habit.weekdays)].sort((a, b) => a - b),
      }));
      const ids = habits.map((habit) => habit.id);

      const saved = await db.$transaction(
        async (tx) => {
          const stored = await tx.habit.findMany({ where: { userId }, select: { id: true, weekdays: true, active: true, goalId: true } });
          await assertOwnGoals(tx, userId, habits.map((habit) => habit.goalId));
          const previousGoal = new Map(stored.map((row) => [row.id, row.goalId]));
          const goalIds = habits.map((h) => (h.goalId === undefined ? (previousGoal.get(h.id) ?? null) : h.goalId));
          // Dias cheios: os hábitos ativos que ficam como estão (fora do lote) mais os ativos do lote.
          const inBatch = new Set(ids);
          const others = stored.filter((row) => row.active && !inBatch.has(row.id));
          const perDay = new Map<Weekday, number>();
          const count = (weekdays: readonly Weekday[]) => weekdays.forEach((day) => perDay.set(day, (perDay.get(day) ?? 0) + 1));
          for (const other of others) count(other.weekdays.map(toWeekday));
          for (const habit of habits) if (habit.active) count(habit.weekdays);
          const full = new Set([...perDay].filter(([, total]) => total > MAX_HABITS_PER_DAY).map(([day]) => day));
          if (full.size > 0) {
            throw new ApiError(
              409,
              'limite_por_dia',
              `Um dia comporta até ${MAX_HABITS_PER_DAY} hábitos. Nada foi salvo.`,
              habits.flatMap((habit, index) =>
                habit.active && habit.weekdays.some((day) => full.has(day))
                  ? [{ path: `habits.${index}.weekdays`, message: `passa de ${MAX_HABITS_PER_DAY} hábitos em ${habit.weekdays.filter((day) => full.has(day)).join(', ')}` }]
                  : [],
              ),
            );
          }

          const rows = await tx.$queryRaw`
            INSERT INTO "habit" ("id", "userId", "title", "weekdays", "active", "goalId")
            SELECT t."id", ${userId}, t."title", string_to_array(t."weekdays", ',')::smallint[], t."active", t."goalId"
            FROM unnest(
              ${habits.map((h) => h.id)}::text[],
              ${habits.map((h) => h.title)}::text[],
              ${habits.map((h) => h.weekdays.join(','))}::text[],
              ${habits.map((h) => h.active)}::boolean[],
              ${goalIds}::text[]
            ) AS t("id", "title", "weekdays", "active", "goalId")
            ON CONFLICT ("id") DO UPDATE SET
              "title" = EXCLUDED."title",
              "weekdays" = EXCLUDED."weekdays",
              "active" = EXCLUDED."active",
              "goalId" = EXCLUDED."goalId"
            WHERE "habit"."userId" = EXCLUDED."userId"
            RETURNING "id"`;
          if (returnedIds.parse(rows).length === habits.length) {
            return habits.map(({ goalId: _goalId, ...habit }, index) => {
              const goalId = goalIds[index];
              return goalId === null ? habit : { ...habit, goalId };
            });
          }
          const foreign = await tx.habit.findMany({ where: { id: { in: ids }, userId: { not: userId } }, select: { id: true } });
          const taken = new Set(foreign.map((row) => row.id));
          throw new ApiError(
            409,
            'conflito_de_id',
            'Algum identificador já pertence a outro registro. Nada foi salvo.',
            habits.flatMap((h, index) => (taken.has(h.id) ? [{ path: `habits.${index}.id`, message: 'já existe um registro com este identificador' }] : [])),
          );
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return c.json({ habits: saved });
    })
    .put('/:id', pathParams(idParamSchema), jsonBody(habitInputSchema), async (c) => {
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
          await assertOwnGoals(tx, userId, [habit.goalId]);
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
