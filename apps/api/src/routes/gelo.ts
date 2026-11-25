import { resumoDoGelo, validarCompraDeGelo } from '@pulo/core/domain/gelo';
import { joiasGanhas, joiasGastas, saldoDeJoias } from '@pulo/core/domain/joias';
import { type Db, Prisma, freezeUseMapper, islandPurchaseMapper } from '@pulo/db';
import { Hono } from 'hono';
import { acertarGeloDaPessoa } from '../gelo';
import { ApiError, type AppEnv, type RouteDeps, requireSession } from '../http';
import { lerFontesDeJoias } from '../joias';
import { freezeUseSelect, islandPurchaseSelect } from '../selects';

/**
 * Compra numa transação serializável: confere o máximo e o saldo com a regra do core e grava `gelo-N` no livro de joias.
 * Duas compras simultâneas não gastam o mesmo saldo (a perdedora recebe 409 `conflito_concorrente`).
 */
async function comprarGelo(db: Db, userId: string, now: number): Promise<void> {
  try {
    await db.$transaction(
      async (tx) => {
        const fontes = await lerFontesDeJoias(tx, userId);
        const compras = await tx.islandPurchase.findMany({
          where: { userId, kind: { not: 'antiga' } },
          select: { ...islandPurchaseSelect, kind: true },
        });
        const usos = await tx.freezeUse.findMany({ where: { userId }, select: freezeUseSelect });
        const gelos = compras.filter((c) => c.kind === 'gelo').length;
        const { guardados } = resumoDoGelo(gelos, usos.map(freezeUseMapper.toDomain));
        const saldo = saldoDeJoias(joiasGanhas(fontes).total, joiasGastas(compras.map(islandPurchaseMapper.toDomain)));
        const validada = validarCompraDeGelo(guardados, saldo);
        if (!validada.ok) throw new ApiError(409, validada.error.code, validada.error.message);
        const purchase = { item: `gelo-${gelos + 1}`, cost: validada.value, createdAt: now };
        await tx.islandPurchase.create({
          data: { ...islandPurchaseMapper.fromDomain(userId, purchase), kind: 'gelo' },
          select: { item: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    // Outro aparelho gravou o mesmo `gelo-N` entre a leitura e o insert.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError(409, 'conflito_concorrente', 'Outra compra aconteceu ao mesmo tempo. Tente de novo.');
    }
    throw error;
  }
}

async function lerGelo(db: Db, userId: string) {
  const [rows, usos] = await db.$transaction([
    db.islandPurchase.findMany({ where: { userId, kind: 'gelo' }, select: islandPurchaseSelect, orderBy: { createdAt: 'asc' } }),
    db.freezeUse.findMany({ where: { userId }, select: freezeUseSelect }),
  ]);
  const compras = rows.map(islandPurchaseMapper.toDomain);
  return { ...resumoDoGelo(compras.length, usos.map(freezeUseMapper.toDomain)), compras };
}

/** Gelo da sequência: `/api/gelo`. Acerta os dias fechados antes de responder ou de vender. */
export function freezeRoutes({ auth, db, now }: RouteDeps) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/', async (c) => {
      await acertarGeloDaPessoa(db, c.var.user, now());
      return c.json(await lerGelo(db, c.var.user.id));
    })
    .post('/', async (c) => {
      const serverNow = now();
      // Antes da compra: um gelo comprado agora não salva um dia que já terminou.
      await acertarGeloDaPessoa(db, c.var.user, serverNow);
      await comprarGelo(db, c.var.user.id, serverNow);
      return c.json(await lerGelo(db, c.var.user.id));
    })
    .put('/visto', async (c) => {
      const { count } = await db.freezeUse.updateMany({
        where: { userId: c.var.user.id, vistoEm: null },
        data: { vistoEm: new Date(now()) },
      });
      return c.json({ vistos: count });
    });
}
