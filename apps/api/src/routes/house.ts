import { islandItemParamSchema, islandPurchaseSchema, roomDecorSchema, roomSpotSchema } from '@pulo/core/api/schemas';
import {
  type EstadoDaCasa,
  type HouseErrorCode,
  estadoDaCasa,
  precoDaDecoracao,
  precoDaParte,
  validarCompraDaDecoracao,
  validarCompraDaParte,
} from '@pulo/core/domain/casa';
import type { Result } from '@pulo/core/domain/result';
import type { Purchase } from '@pulo/core/domain/types';
import { type Db, Prisma, islandPurchaseMapper, roomPlacementMapper } from '@pulo/db';
import { Hono } from 'hono';
import { unlockAchievements } from '../achievements';
import { ApiError, type AppEnv, type Client, type RouteDeps, assertNotInFuture, jsonBody, pathParams, requireMatch, requireSession, sameValue } from '../http';
import { lerFontesDeJoias } from '../joias';
import { islandPurchaseSelect, roomDecorSelect } from '../selects';

type Regra = (item: string, estado: EstadoDaCasa) => Result<number, HouseErrorCode>;

/** O preço do pedido precisa ser o do catálogo. */
function conferirPreco(preco: number | null, cost: number, inexistente: string): void {
  if (preco === null) throw new ApiError(404, 'item_inexistente', inexistente);
  if (cost !== preco) throw new ApiError(400, 'preco_divergente', `Esse item custa ${preco} joias.`);
}

const jaComprado = () => new ApiError(409, 'ja_comprado', 'Esse item já é seu.');

/**
 * Compra numa transação serializável: lê os registros e as compras, valida com a regra do core e grava.
 * Duas compras simultâneas não gastam o mesmo saldo, e o mesmo item só é pago uma vez.
 * Repetir a mesma compra (item, preço e instante) é aceito sem gravar de novo (retry seguro).
 */
async function comprar(db: Db, userId: string, purchase: Purchase, regra: Regra, gravar: (tx: Client) => Promise<unknown>): Promise<void> {
  try {
    await db.$transaction(
      async (tx) => {
        const fontes = await lerFontesDeJoias(tx, userId);
        const casa = await tx.islandPurchase.findMany({ where: { userId, kind: 'casa' }, select: islandPurchaseSelect });
        const quarto = await tx.islandPurchase.findMany({ where: { userId, kind: 'decoracao' }, select: roomDecorSelect });
        const compras = casa.map(islandPurchaseMapper.toDomain);
        const decor = quarto.map(roomPlacementMapper.toDomain);

        const repetida = [...compras, ...decor].find((p) => p.item === purchase.item);
        if (repetida && sameValue({ item: repetida.item, cost: repetida.cost, createdAt: repetida.createdAt }, purchase)) return;

        const validada = regra(purchase.item, estadoDaCasa(fontes, compras, decor));
        if (!validada.ok) {
          throw new ApiError(validada.error.code === 'item_inexistente' ? 404 : 409, validada.error.code, validada.error.message);
        }
        await gravar(tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    // Outro aparelho gravou o mesmo item entre a leitura e o insert.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw jaComprado();
    throw error;
  }
}

/** Casa do sapo: `/api/house`. Partes compradas com joias, sem ordem; só `DELETE /api/data` apaga. */
export function houseRoutes({ auth, db, now }: RouteDeps) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/', async (c) => {
      const userId = c.var.user.id;
      const [rows, credito] = await db.$transaction([
        db.islandPurchase.findMany({ where: { userId, kind: 'casa' }, select: islandPurchaseSelect, orderBy: { createdAt: 'asc' } }),
        db.joiaCredit.findUnique({ where: { userId }, select: { amount: true } }),
      ]);
      return c.json({ purchases: rows.map(islandPurchaseMapper.toDomain), joiaCredit: credito?.amount ?? 0 });
    })
    .put('/:item', pathParams(islandItemParamSchema), jsonBody(islandPurchaseSchema), async (c) => {
      const purchase = c.req.valid('json');
      requireMatch(c.req.valid('param').item, purchase.item, 'id_divergente');
      assertNotInFuture(purchase.createdAt, now(), 'createdAt');
      conferirPreco(precoDaParte(purchase.item), purchase.cost, 'Essa parte da casa não existe.');
      const userId = c.var.user.id;
      await comprar(db, userId, purchase, validarCompraDaParte, (tx) =>
        tx.islandPurchase.create({ data: { ...islandPurchaseMapper.fromDomain(userId, purchase), kind: 'casa' }, select: { item: true } }),
      );
      const newAchievements = await unlockAchievements(db, c.var.user, now());
      return c.json({ purchase, newAchievements });
    });
}

/** Quarto: `/api/room`. Comprar uma decoração gasta joias; mudar de lugar é grátis. */
export function roomRoutes({ auth, db, now }: RouteDeps) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/', async (c) => {
      const rows = await db.islandPurchase.findMany({
        where: { userId: c.var.user.id, kind: 'decoracao' },
        select: roomDecorSelect,
        orderBy: { createdAt: 'asc' },
        relationLoadStrategy: 'join',
      });
      return c.json({ decor: rows.map(roomPlacementMapper.toDomain) });
    })
    .put('/:item', pathParams(islandItemParamSchema), jsonBody(roomDecorSchema), async (c) => {
      const decor = c.req.valid('json');
      const { item, cost, createdAt, x, y, rotation } = decor;
      requireMatch(c.req.valid('param').item, item, 'id_divergente');
      assertNotInFuture(createdAt, now(), 'createdAt');
      conferirPreco(precoDaDecoracao(item), cost, 'Esse item não existe na loja.');
      const userId = c.var.user.id;
      const purchase = { item, cost, createdAt };
      await comprar(db, userId, purchase, validarCompraDaDecoracao, async (tx) => {
        await tx.islandPurchase.create({ data: { ...islandPurchaseMapper.fromDomain(userId, purchase), kind: 'decoracao' }, select: { item: true } });
        await tx.roomPlacement.create({ data: { userId, item, x, y, rotation }, select: { item: true } });
      });
      // Numa repetição, a posição que vale é a gravada (o item pode ter mudado de lugar depois da compra).
      const row = await db.islandPurchase.findUniqueOrThrow({
        where: { userId_item: { userId, item } },
        select: roomDecorSelect,
        relationLoadStrategy: 'join',
      });
      return c.json({ decor: roomPlacementMapper.toDomain(row) });
    })
    .patch('/:item', pathParams(islandItemParamSchema), jsonBody(roomSpotSchema), async (c) => {
      const { item } = c.req.valid('param');
      if (precoDaDecoracao(item) === null) throw new ApiError(404, 'item_inexistente', 'Esse item não existe na loja.');
      const spot = c.req.valid('json');
      const { count } = await db.roomPlacement.updateMany({ where: { userId: c.var.user.id, item }, data: spot });
      if (count === 0) throw new ApiError(404, 'nao_encontrado', 'Compre esse item antes de mudar ele de lugar.');
      return c.json({ item, spot });
    });
}
