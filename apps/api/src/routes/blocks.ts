import { idParamSchema, routineBlockSchema } from '@pulo/core/api/schemas';
import { routineBlockMapper } from '@pulo/db';
import { Hono } from 'hono';
import { type AppEnv, type RouteDeps, jsonBody, pathParams, requireMatch, requireSession } from '../http';
import { blockSelect } from '../selects';

/** Rotina semanal: `/api/blocks`. */
export function blockRoutes({ auth, db }: RouteDeps) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/', async (c) => {
      const rows = await db.routineBlock.findMany({
        where: { userId: c.var.user.id },
        select: blockSelect,
        orderBy: [{ weekday: 'asc' }, { startMinutes: 'asc' }],
      });
      return c.json({ blocks: rows.map(routineBlockMapper.toDomain) });
    })
    .put('/:id', pathParams(idParamSchema), jsonBody(routineBlockSchema), async (c) => {
      const block = c.req.valid('json');
      requireMatch(c.req.valid('param').id, block.id, 'id_divergente');
      const userId = c.var.user.id;
      const { id: _id, userId: _owner, ...update } = routineBlockMapper.fromDomain(userId, block);
      const row = await db.routineBlock.upsert({
        where: { id_userId: { id: block.id, userId } },
        create: routineBlockMapper.fromDomain(userId, block),
        update,
        select: blockSelect,
      });
      return c.json({ block: routineBlockMapper.toDomain(row) });
    })
    .delete('/:id', pathParams(idParamSchema), async (c) => {
      const { count } = await db.routineBlock.deleteMany({ where: { id: c.req.valid('param').id, userId: c.var.user.id } });
      return c.json({ deleted: count });
    });
}
