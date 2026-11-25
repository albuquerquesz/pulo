import { MAX_HABITS_PER_DAY } from '@pulo/core/config/decisions';
import { habitInputSchema, habitsBatchSchema, idParamSchema } from '@pulo/core/api/schemas';
import { dateKeyOf } from '@pulo/core/domain/day';
import { computeHabitStats } from '@pulo/core/domain/habit-stats';
import { resolveHabitState } from '@pulo/core/domain/habits';
import type { Habit, Weekday } from '@pulo/core/domain/types';
import { Prisma, habitLogMapper, habitMapper, restDayMapper, toWeekday } from '@pulo/db';
import { Hono } from 'hono';
import { z } from 'zod';
import { acertarGeloDaPessoa } from '../gelo';
import { habitFromRow, habitResponse } from '../habits';
import { ApiError, type AppEnv, type Client, type RouteDeps, jsonBody, pathParams, requireMatch, requireSession } from '../http';
import { habitSelect, restDaySelect } from '../selects';

const returnedIds = z.array(z.object({ id: z.string() }));

type HabitInput = z.infer<typeof habitInputSchema>;

/** `undefined` (não veio) mantém o gravado; `null` limpa. */
function keep<T>(sent: T | null | undefined, stored: T | undefined): T | undefined {
  return sent === undefined ? stored : (sent ?? undefined);
}

/** O hábito que fica gravado: o enviado sobre o que já existe (clientes antigos não conhecem os campos novos). */
function mergeHabit(sent: HabitInput, stored: Habit | undefined): Habit {
  const goalId = keep(sent.goalId, stored?.goalId);
  const icon = keep(sent.icon, stored?.icon);
  const color = keep(sent.color, stored?.color);
  const period = keep(sent.period, stored?.period);
  const reminderMinutes = keep(sent.reminderMinutes, stored?.reminderMinutes);
  // Sem horário não há o que ligar.
  const reminderOn = reminderMinutes !== undefined && (sent.reminderOn ?? stored?.reminderOn ?? false);
  return {
    id: sent.id,
    title: sent.title,
    weekdays: [...new Set(sent.weekdays)].sort((a, b) => a - b),
    state: resolveHabitState(sent, stored?.state),
    ...(goalId === undefined ? {} : { goalId }),
    ...(icon === undefined ? {} : { icon }),
    ...(color === undefined ? {} : { color }),
    ...(period === undefined ? {} : { period }),
    ...(reminderMinutes === undefined ? {} : { reminderMinutes }),
    ...(reminderOn ? { reminderOn } : {}),
  };
}

/** Todas as colunas opcionais preenchidas: o que ficou de fora do hábito é gravado como vazio. */
function habitData(userId: string, habit: Habit) {
  return habitMapper.fromDomain(userId, {
    ...habit,
    goalId: habit.goalId ?? null,
    icon: habit.icon ?? null,
    color: habit.color ?? null,
    period: habit.period ?? null,
    reminderMinutes: habit.reminderMinutes ?? null,
    reminderOn: habit.reminderOn ?? false,
  });
}

/** As metas atreladas precisam ser da pessoa; a de outra responde como se não existisse. Uma query, e só quando há vínculo. */
async function assertOwnGoals(tx: Client, userId: string, goalIds: readonly (string | null | undefined)[]) {
  const ids = [...new Set(goalIds.filter((id) => typeof id === 'string'))];
  if (ids.length === 0) return;
  const owned = await tx.goal.count({ where: { userId, id: { in: ids } } });
  if (owned !== ids.length) throw new ApiError(404, 'referencia_inexistente', 'A meta não existe.');
}

/** Hábitos: `/api/habits`. Campo opcional omitido mantém o gravado; `null` limpa. */
export function habitRoutes({ auth, db, now }: RouteDeps) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/', async (c) => {
      const rows = await db.habit.findMany({ where: { userId: c.var.user.id }, select: habitSelect, orderBy: { id: 'asc' } });
      return c.json({ habits: rows.map(habitFromRow) });
    })
    // Lote (onboarding): as invariantes da rota de um hábito, para todos de uma vez, com um número fixo de queries
    // (ler os hábitos, um INSERT ... SELECT unnest ... ON CONFLICT) numa transação serializável. Tudo ou nada.
    .put('/', jsonBody(habitsBatchSchema), async (c) => {
      const userId = c.var.user.id;
      const sent = c.req.valid('json').habits;
      const ids = sent.map((habit) => habit.id);

      const saved = await db.$transaction(
        async (tx) => {
          const stored = (await tx.habit.findMany({ where: { userId }, select: habitSelect })).map(habitMapper.toDomain);
          await assertOwnGoals(tx, userId, sent.map((habit) => habit.goalId));
          const previous = new Map(stored.map((habit) => [habit.id, habit]));
          const habits = sent.map((habit) => mergeHabit(habit, previous.get(habit.id)));
          // Dias cheios: os hábitos ativos que ficam como estão (fora do lote) mais os ativos do lote.
          const inBatch = new Set(ids);
          const others = stored.filter((habit) => habit.state === 'ativo' && !inBatch.has(habit.id));
          const perDay = new Map<Weekday, number>();
          for (const habit of [...others, ...habits.filter((h) => h.state === 'ativo')]) {
            for (const day of habit.weekdays.map(toWeekday)) perDay.set(day, (perDay.get(day) ?? 0) + 1);
          }
          const full = new Set([...perDay].filter(([, total]) => total > MAX_HABITS_PER_DAY).map(([day]) => day));
          if (full.size > 0) {
            throw new ApiError(
              409,
              'limite_por_dia',
              `Um dia comporta até ${MAX_HABITS_PER_DAY} hábitos. Nada foi salvo.`,
              habits.flatMap((habit, index) =>
                habit.state === 'ativo' && habit.weekdays.some((day) => full.has(day))
                  ? [{ path: `habits.${index}.weekdays`, message: `passa de ${MAX_HABITS_PER_DAY} hábitos em ${habit.weekdays.filter((day) => full.has(day)).join(', ')}` }]
                  : [],
              ),
            );
          }

          const rows = await tx.$queryRaw`
            INSERT INTO "habit" ("id", "userId", "title", "weekdays", "state", "goalId", "icon", "color", "period", "reminderMinutes", "reminderOn")
            SELECT t."id", ${userId}, t."title", string_to_array(t."weekdays", ',')::smallint[], t."state", t."goalId",
              t."icon", t."color", t."period", t."reminderMinutes", t."reminderOn"
            FROM unnest(
              ${habits.map((h) => h.id)}::text[],
              ${habits.map((h) => h.title)}::text[],
              ${habits.map((h) => h.weekdays.join(','))}::text[],
              ${habits.map((h) => h.state)}::"habit_state"[],
              ${habits.map((h) => h.goalId ?? null)}::text[],
              ${habits.map((h) => h.icon ?? null)}::text[],
              ${habits.map((h) => h.color ?? null)}::"accent_color"[],
              ${habits.map((h) => h.period ?? null)}::"habit_period"[],
              ${habits.map((h) => h.reminderMinutes ?? null)}::smallint[],
              ${habits.map((h) => h.reminderOn ?? false)}::boolean[]
            ) AS t("id", "title", "weekdays", "state", "goalId", "icon", "color", "period", "reminderMinutes", "reminderOn")
            ON CONFLICT ("id") DO UPDATE SET
              "title" = EXCLUDED."title",
              "weekdays" = EXCLUDED."weekdays",
              "state" = EXCLUDED."state",
              "goalId" = EXCLUDED."goalId",
              "icon" = EXCLUDED."icon",
              "color" = EXCLUDED."color",
              "period" = EXCLUDED."period",
              "reminderMinutes" = EXCLUDED."reminderMinutes",
              "reminderOn" = EXCLUDED."reminderOn"
            WHERE "habit"."userId" = EXCLUDED."userId"
            RETURNING "id"`;
          if (returnedIds.parse(rows).length === habits.length) return habits;
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
      return c.json({ habits: saved.map(habitResponse) });
    })
    .put('/:id', pathParams(idParamSchema), jsonBody(habitInputSchema), async (c) => {
      const sent = c.req.valid('json');
      requireMatch(c.req.valid('param').id, sent.id, 'id_divergente');
      const userId = c.var.user.id;

      // Leitura dos hábitos e escrita na mesma transação serializável: duas escritas simultâneas não passam
      // juntas do limite por dia (a perdedora recebe 409 conflito_concorrente).
      const row = await db.$transaction(
        async (tx) => {
          const stored = (await tx.habit.findMany({ where: { userId }, select: habitSelect })).map(habitMapper.toDomain);
          const habit = mergeHabit(sent, stored.find((h) => h.id === sent.id));
          if (habit.state === 'ativo') {
            const others = stored.filter((other) => other.state === 'ativo' && other.id !== habit.id);
            const overLimit = habit.weekdays.find(
              (weekday: Weekday) => others.filter((other) => other.weekdays.includes(weekday)).length >= MAX_HABITS_PER_DAY,
            );
            if (overLimit !== undefined) {
              throw new ApiError(409, 'limite_por_dia', `Um dia comporta até ${MAX_HABITS_PER_DAY} hábitos.`);
            }
          }
          await assertOwnGoals(tx, userId, [sent.goalId]);
          const data = habitData(userId, habit);
          const { id: _id, userId: _owner, ...update } = data;
          return tx.habit.upsert({
            where: { id_userId: { id: habit.id, userId } },
            create: data,
            update,
            select: habitSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return c.json({ habit: habitFromRow(row) });
    })
    // Estatísticas e calendário: três leituras fixas, só do hábito pedido (o sync não carrega o histórico por hábito).
    .get('/:id/stats', pathParams(idParamSchema), async (c) => {
      const { id: userId, metadata } = c.var.user;
      const { id } = c.req.valid('param');
      const [habit, logs, restDays] = await db.$transaction([
        db.habit.findFirst({ where: { id, userId }, select: { weekdays: true, createdAt: true } }),
        db.habitLog.findMany({ where: { userId, habitId: id }, select: { habitId: true, date: true, doneAt: true } }),
        db.restDay.findMany({ where: { userId }, select: restDaySelect }),
      ]);
      if (habit === null) throw new ApiError(404, 'referencia_inexistente', 'O hábito não existe.');
      const dayStartMinutes = metadata.profile?.dayStartMinutes;
      const stats = computeHabitStats({
        habito: {
          weekdays: habit.weekdays.map(toWeekday),
          ...(habit.createdAt === null ? {} : { criadoEm: dateKeyOf(habit.createdAt.getTime(), metadata.timezone, dayStartMinutes) }),
        },
        logs: logs.map(habitLogMapper.toDomain),
        restDays: restDays.map(restDayMapper.toDomain),
        vacation: metadata.vacation,
        timeZone: metadata.timezone,
        dayStartMinutes,
        now: now(),
      });
      return c.json({ stats });
    })
    .delete('/:id', pathParams(idParamSchema), async (c) => {
      // Acerta o gelo antes: apagar o hábito não pode fazer dias já cumpridos gastarem gelo.
      await acertarGeloDaPessoa(db, c.var.user, now());
      // Os registros do hábito saem junto (cascade no banco).
      const { count } = await db.habit.deleteMany({ where: { id: c.req.valid('param').id, userId: c.var.user.id } });
      return c.json({ deleted: count });
    });
}
