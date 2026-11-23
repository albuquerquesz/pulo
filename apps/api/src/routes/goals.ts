import { GOALS } from '@pulo/core/config/decisions';
import { goalSchema, idParamSchema } from '@pulo/core/api/schemas';
import { Prisma, goalMapper } from '@pulo/db';
import { Hono } from 'hono';
import { ApiError, type AppEnv, type RouteDeps, jsonBody, pathParams, requireMatch, requireSession } from '../http';
import { goalSelect } from '../selects';

/** Metas de longo prazo: `/api/goals`. Os marcos vêm dentro da meta (um PUT grava tudo). */
export function goalRoutes({ auth, db }: RouteDeps) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/', async (c) => {
      const rows = await db.goal.findMany({ where: { userId: c.var.user.id }, select: goalSelect, orderBy: { createdAt: 'asc' } });
      return c.json({ goals: rows.map(goalMapper.toDomain) });
    })
    .put('/:id', pathParams(idParamSchema), jsonBody(goalSchema), async (c) => {
      const goal = c.req.valid('json');
      requireMatch(c.req.valid('param').id, goal.id, 'id_divergente');
      const userId = c.var.user.id;
      const data = goalMapper.fromDomain(userId, goal);
      const { id: _id, userId: _owner, ...update } = data;

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
          return tx.goal.upsert({ where: { id_userId: { id: goal.id, userId } }, create: data, update, select: goalSelect });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return c.json({ goal: goalMapper.toDomain(row) });
    })
    .delete('/:id', pathParams(idParamSchema), async (c) => {
      const { count } = await db.goal.deleteMany({ where: { id: c.req.valid('param').id, userId: c.var.user.id } });
      return c.json({ deleted: count });
    });
}
