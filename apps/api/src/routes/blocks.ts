import { blocksBatchSchema, idParamSchema, routineBlockInputSchema } from '@pulo/core/api/schemas';
import { slotOverlaps } from '@pulo/core/domain/ia/candidates';
import type { RoutineBlock } from '@pulo/core/domain/types';
import { routineBlockMapper } from '@pulo/db';
import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError, type AppEnv, type Client, type RouteDeps, jsonBody, pathParams, requireMatch, requireSession } from '../http';
import { blockSelect } from '../selects';

const returnedBlocks = z.array(z.object({ id: z.string(), icon: z.string().nullable() }));

/**
 * Uma escrita de blocos por pessoa de cada vez: dois aparelhos não passam juntos pela conferência de horário. A trava
 * (em vez de Serializable) deixa o app e o MCP gravarem vários blocos em paralelo sem conflitos falsos.
 */
const travarRotina = (tx: Client, userId: string) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`rotina:${userId}`}, 0))`;

type SlotDoBloco = Pick<RoutineBlock, 'id' | 'weekday' | 'startMinutes' | 'durationMinutes'>;

/**
 * A regra de sobreposição do core, no servidor. Só vale para bloco novo ou que mudou de horário: um par que já
 * estava cruzado não trava a troca de título ou de ícone.
 */
function conferirHorarios(stored: readonly RoutineBlock[], written: readonly SlotDoBloco[]): void {
  const before = new Map(stored.map((b) => [b.id, b]));
  const after = new Map<string, SlotDoBloco>([...stored, ...written].map((b) => [b.id, b]));
  const clashes = written.flatMap((block, index) => {
    const old = before.get(block.id);
    if (old && old.weekday === block.weekday && old.startMinutes === block.startMinutes && old.durationMinutes === block.durationMinutes) return [];
    const busy = [...after.values()].some((other) => other.id !== block.id && slotOverlaps(block, other));
    return busy ? [{ path: `blocks.${index}`, message: 'já existe um bloco nesse horário' }] : [];
  });
  if (clashes.length > 0) throw new ApiError(409, 'horario_ocupado', 'Já existe um bloco nesse horário.', clashes);
}

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
    // Lote (onboarding): UM INSERT ... SELECT unnest(...) ON CONFLICT para qualquer quantidade de blocos, numa transação.
    // O número de queries não depende do tamanho do lote; tudo ou nada.
    .put('/', jsonBody(blocksBatchSchema), async (c) => {
      const { blocks } = c.req.valid('json');
      const userId = c.var.user.id;
      const saved = await db.$transaction(async (tx) => {
        await travarRotina(tx, userId);
        const stored = await tx.routineBlock.findMany({ where: { userId }, select: blockSelect });
        conferirHorarios(stored.map(routineBlockMapper.toDomain), blocks);
        const rows = await tx.$queryRaw`
          INSERT INTO "routine_block" ("id", "userId", "weekday", "startMinutes", "durationMinutes", "kind", "title", "icon")
          SELECT t."id", ${userId}, t."weekday", t."startMinutes", t."durationMinutes", t."kind", t."title",
            CASE WHEN t."keepIcon" THEN r."icon" ELSE t."icon" END
          FROM unnest(
            ${blocks.map((b) => b.id)}::text[],
            ${blocks.map((b) => b.weekday)}::smallint[],
            ${blocks.map((b) => b.startMinutes)}::smallint[],
            ${blocks.map((b) => b.durationMinutes)}::smallint[],
            ${blocks.map((b) => b.kind)}::"block_kind"[],
            ${blocks.map((b) => b.title ?? null)}::text[],
            ${blocks.map((b) => b.icon ?? null)}::text[],
            ${blocks.map((b) => b.icon === undefined)}::boolean[]
          ) AS t("id", "weekday", "startMinutes", "durationMinutes", "kind", "title", "icon", "keepIcon")
          LEFT JOIN "routine_block" r ON r."id" = t."id" AND r."userId" = ${userId}
          ON CONFLICT ("id") DO UPDATE SET
            "weekday" = EXCLUDED."weekday",
            "startMinutes" = EXCLUDED."startMinutes",
            "durationMinutes" = EXCLUDED."durationMinutes",
            "kind" = EXCLUDED."kind",
            "title" = EXCLUDED."title",
            "icon" = EXCLUDED."icon"
          WHERE "routine_block"."userId" = EXCLUDED."userId"
          RETURNING "id", "icon"`;
        const written = returnedBlocks.parse(rows);
        if (written.length === blocks.length) return new Map(written.map((row) => [row.id, row.icon]));
        // Algum id é de outra pessoa (o WHERE acima o pulou): desfaz o lote inteiro e diz quais itens.
        const foreign = await tx.routineBlock.findMany({
          where: { id: { in: blocks.map((b) => b.id) }, userId: { not: userId } },
          select: { id: true },
        });
        const taken = new Set(foreign.map((row) => row.id));
        throw new ApiError(
          409,
          'conflito_de_id',
          'Algum identificador já pertence a outro registro. Nada foi salvo.',
          blocks.flatMap((b, index) => (taken.has(b.id) ? [{ path: `blocks.${index}.id`, message: 'já existe um registro com este identificador' }] : [])),
        );
      });
      return c.json({
        blocks: blocks.map(({ icon: _icon, ...block }) => {
          const icon = saved.get(block.id);
          return typeof icon === 'string' ? { ...block, icon } : block;
        }),
      });
    })
    .put('/:id', pathParams(idParamSchema), jsonBody(routineBlockInputSchema), async (c) => {
      const block = c.req.valid('json');
      requireMatch(c.req.valid('param').id, block.id, 'id_divergente');
      const userId = c.var.user.id;
      const { id: _id, userId: _owner, ...update } = routineBlockMapper.fromDomain(userId, block);
      const row = await db.$transaction(async (tx) => {
        await travarRotina(tx, userId);
        const stored = await tx.routineBlock.findMany({
          where: { userId, OR: [{ id: block.id }, { weekday: block.weekday }] },
          select: blockSelect,
        });
        conferirHorarios(stored.map(routineBlockMapper.toDomain), [block]);
        return tx.routineBlock.upsert({
          where: { id_userId: { id: block.id, userId } },
          create: routineBlockMapper.fromDomain(userId, block),
          update,
          select: blockSelect,
        });
      });
      return c.json({ block: routineBlockMapper.toDomain(row) });
    })
    .delete('/:id', pathParams(idParamSchema), async (c) => {
      const { count } = await db.routineBlock.deleteMany({ where: { id: c.req.valid('param').id, userId: c.var.user.id } });
      return c.json({ deleted: count });
    });
}
