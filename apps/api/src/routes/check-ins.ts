import { checkInSchema, dateRangeQuerySchema, idParamSchema } from '@pulo/core/api/schemas';
import { checkInMapper } from '@pulo/db';
import { Hono } from 'hono';
import {
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
import { checkInSelect } from '../selects';

/** Check ins de energia: `/api/check-ins`. */
export function checkInRoutes({ auth, db, now }: RouteDeps) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/', queryParams(dateRangeQuerySchema), async (c) => {
      const date = dateFilter(c.req.valid('query'));
      const rows = await db.checkIn.findMany({
        where: { userId: c.var.user.id, ...(date ? { date } : {}) },
        select: checkInSelect,
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      });
      return c.json({ checkIns: rows.map(checkInMapper.toDomain) });
    })
    .put('/:id', pathParams(idParamSchema), jsonBody(checkInSchema), async (c) => {
      const checkIn = c.req.valid('json');
      requireMatch(c.req.valid('param').id, checkIn.id, 'id_divergente');
      assertNotInFuture(checkIn.createdAt, now(), 'createdAt');
      const userId = c.var.user.id;
      const { id: _id, userId: _owner, ...update } = checkInMapper.fromDomain(userId, checkIn);
      const row = await db.checkIn.upsert({
        where: { id_userId: { id: checkIn.id, userId } },
        create: checkInMapper.fromDomain(userId, checkIn),
        update,
        select: checkInSelect,
      });
      return c.json({ checkIn: checkInMapper.toDomain(row) });
    });
}
