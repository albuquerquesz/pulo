import { GOALS, JOIAS } from '@pulo/core/config/decisions';
import { podeAbrirBau, validarEscritaDaMeta } from '@pulo/core/domain/goals';
import { goalSchema, idParamSchema } from '@pulo/core/api/schemas';
import { Prisma, goalChestMapper, goalMapper } from '@pulo/db';
import { Hono } from 'hono';
import { unlockAchievements } from '../achievements';
import { ApiError, type AppEnv, CLOCK_SKEW_MS, type RouteDeps, jsonBody, pathParams, requireMatch, requireSession } from '../http';
import { goalChestSelect, goalSelect } from '../selects';

/**
 * Metas de longo prazo: `/api/goals`. Os marcos vêm dentro da meta (um PUT grava tudo; `icon` e `color` omitidos ficam).
 * O prêmio de uma meta concluída só entra no saldo quando o baú é aberto, uma vez por meta, pelas regras de `podeAbrirBau`.
 * `createdAt` fica o da primeira gravação.
 */
export function goalRoutes({ auth, db, now }: RouteDeps) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/', async (c) => {
      const where = { userId: c.var.user.id };
      const [rows, chests] = await db.$transaction([
        db.goal.findMany({ where, select: goalSelect, orderBy: { createdAt: 'asc' } }),
        db.goalChest.findMany({ where, select: goalChestSelect, orderBy: { abertoEm: 'asc' } }),
      ]);
      return c.json({ goals: rows.map(goalMapper.toDomain), chests: chests.map(goalChestMapper.toDomain) });
    })
    .put('/:id', pathParams(idParamSchema), jsonBody(goalSchema), async (c) => {
      const goal = c.req.valid('json');
      requireMatch(c.req.valid('param').id, goal.id, 'id_divergente');
      const { id: userId, metadata } = c.var.user;
      const data = goalMapper.fromDomain(userId, goal);
      const { id: _id, userId: _owner, createdAt: _createdAt, ...update } = data;

      // Contar as outras ativas e gravar na mesma transação serializável: duas escritas
      // simultâneas não passam juntas do limite (a perdedora recebe 409 conflito_concorrente).
      const row = await db.$transaction(
        async (tx) => {
          if (goal.state === 'ativa') {
            const others = await tx.goal.count({ where: { userId, state: 'ativa', id: { not: goal.id } } });
            if (others >= GOALS.maxActive) {
              throw new ApiError(409, 'limite_de_metas', `Até ${GOALS.maxActive} metas ativas de cada vez.`);
            }
          }
          const stored = await tx.goal.findUnique({ where: { id_userId: { id: goal.id, userId } }, select: goalSelect });
          const valida = validarEscritaDaMeta({
            meta: goal,
            ...(stored ? { anterior: goalMapper.toDomain(stored) } : {}),
            now: now(),
            timeZone: metadata.timezone,
            folgaMs: CLOCK_SKEW_MS,
          });
          if (!valida.ok) throw new ApiError(409, valida.error.code, valida.error.message);
          return tx.goal.upsert({ where: { id_userId: { id: goal.id, userId } }, create: data, update, select: goalSelect });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      // Só meta concluída ou marco riscado mudam as conquistas.
      const andou = goal.state === 'concluida' || goal.milestones.some((m) => m.doneAt !== undefined);
      const newAchievements = andou ? await unlockAchievements(db, c.var.user, now()) : [];
      return c.json({ goal: goalMapper.toDomain(row), newAchievements });
    })
    .post('/:id/chest', pathParams(idParamSchema), async (c) => {
      const { id } = c.req.valid('param');
      const userId = c.var.user.id;
      const chest = { goalId: id, abertoEm: now(), joias: JOIAS.por.goalCompleted };

      // Ler o estado da meta e gravar na mesma transação serializável: a meta não é reaberta no meio.
      await db.$transaction(
        async (tx) => {
          const goal = await tx.goal.findUnique({ where: { id_userId: { id, userId } }, select: goalSelect });
          if (!goal) throw new ApiError(404, 'meta_inexistente', 'Essa meta não existe mais.');
          const baus = await tx.goalChest.findMany({ where: { userId }, select: goalChestSelect });
          const pode = podeAbrirBau(goalMapper.toDomain(goal), baus.map(goalChestMapper.toDomain), chest.abertoEm);
          if (!pode.ok) throw new ApiError(409, pode.error.code, pode.error.message);
          // A chave (pessoa, meta) garante um resgate só.
          const { count } = await tx.goalChest.createMany({ data: [goalChestMapper.fromDomain(userId, chest)], skipDuplicates: true });
          if (count === 0) throw new ApiError(409, 'bau_ja_aberto', 'Esse baú já foi aberto.');
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      const newAchievements = await unlockAchievements(db, c.var.user, now());
      return c.json({ chest, newAchievements });
    })
    .delete('/:id', pathParams(idParamSchema), async (c) => {
      const { count } = await db.goal.deleteMany({ where: { id: c.req.valid('param').id, userId: c.var.user.id } });
      return c.json({ deleted: count });
    });
}
