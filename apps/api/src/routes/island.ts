import { islandItemParamSchema, islandPurchaseSchema } from '@pulo/core/api/schemas';
import { estadoDaIlha, precoDoItem, validarCompra } from '@pulo/core/domain/ilha';
import { Prisma, islandPurchaseMapper } from '@pulo/db';
import { Hono } from 'hono';
import { ApiError, type AppEnv, type RouteDeps, assertNotInFuture, jsonBody, pathParams, requireMatch, requireSession, sameValue } from '../http';
import { lerFontesDeJoias } from '../joias';
import { islandPurchaseSelect } from '../selects';

/**
 * Ilha antiga: `/api/island` (legado da spec 12, até a tela da casa). As compras são imutáveis (uma por item; só
 * `DELETE /api/data` apaga). O saldo de joias nunca é gravado: o servidor recalcula a partir dos registros antes de cada compra.
 */
export function islandRoutes({ auth, db, now }: RouteDeps) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/purchases', async (c) => {
      const rows = await db.islandPurchase.findMany({
        where: { userId: c.var.user.id, kind: 'antiga' },
        select: islandPurchaseSelect,
        orderBy: { createdAt: 'asc' },
      });
      return c.json({ purchases: rows.map(islandPurchaseMapper.toDomain) });
    })
    .put('/purchases/:item', pathParams(islandItemParamSchema), jsonBody(islandPurchaseSchema), async (c) => {
      const purchase = c.req.valid('json');
      requireMatch(c.req.valid('param').item, purchase.item, 'id_divergente');
      assertNotInFuture(purchase.createdAt, now(), 'createdAt');
      const preco = precoDoItem(purchase.item);
      if (preco === null) throw new ApiError(404, 'item_inexistente', 'Esse item não existe na ilha.');
      if (purchase.cost !== preco) throw new ApiError(400, 'preco_divergente', `Esse item custa ${preco} moscas.`);
      const userId = c.var.user.id;

      // Ler os registros e as compras e gravar na mesma transação serializável: duas compras simultâneas
      // não gastam o mesmo saldo (a perdedora recebe 409 conflito_concorrente).
      const row = await db.$transaction(
        async (tx) => {
          const fontes = await lerFontesDeJoias(tx, userId);
          const todas = await tx.islandPurchase.findMany({ where: { userId }, select: { ...islandPurchaseSelect, kind: true } });
          const compras = todas.filter((p) => p.kind === 'antiga').map(islandPurchaseMapper.toDomain);
          const novas = todas.filter((p) => p.kind !== 'antiga').map(islandPurchaseMapper.toDomain);

          // Repetir exatamente a mesma compra é aceito (retry seguro); qualquer outra coisa no mesmo item é recusada abaixo.
          const repetida = compras.find((p) => p.item === purchase.item);
          if (repetida && sameValue(repetida, purchase)) return repetida;

          const estado = estadoDaIlha(fontes, compras, novas);
          const validada = validarCompra(purchase.item, estado);
          if (!validada.ok) {
            throw new ApiError(validada.error.code === 'item_inexistente' ? 404 : 409, validada.error.code, validada.error.message);
          }
          const created = await tx.islandPurchase.create({ data: islandPurchaseMapper.fromDomain(userId, purchase), select: islandPurchaseSelect });
          return islandPurchaseMapper.toDomain(created);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return c.json({ purchase: row });
    });
}
