import { islandPurchaseMapper } from '@pulo/db';
import { Hono } from 'hono';
import { type AppEnv, type RouteDeps, requireSession } from '../http';
import { islandPurchaseSelect } from '../selects';

/**
 * Ilha antiga: `/api/island` (legado da spec 12). Só leitura: nenhuma tela compra nela, e as compras que existem
 * ficam guardadas (só `DELETE /api/data` apaga).
 */
export function islandRoutes({ auth, db }: RouteDeps) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/purchases', async (c) => {
      const rows = await db.islandPurchase.findMany({
        where: { userId: c.var.user.id, kind: 'antiga' },
        select: islandPurchaseSelect,
        orderBy: { createdAt: 'asc' },
      });
      return c.json({ purchases: rows.map(islandPurchaseMapper.toDomain) });
    });
}
