import { blocksBatchSchema, idParamSchema, routineBlockSchema } from '@pulo/core/api/schemas';
import { routineBlockMapper } from '@pulo/db';
import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError, type AppEnv, type RouteDeps, jsonBody, pathParams, requireMatch, requireSession } from '../http';
import { blockSelect } from '../selects';

const returnedIds = z.array(z.object({ id: z.string() }));

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
      await db.$transaction(async (tx) => {
        const rows = await tx.$queryRaw`
          INSERT INTO "routine_block" ("id", "userId", "weekday", "startMinutes", "durationMinutes", "kind", "title")
          SELECT t."id", ${userId}, t."weekday", t."startMinutes", t."durationMinutes", t."kind", t."title"
          FROM unnest(
            ${blocks.map((b) => b.id)}::text[],
            ${blocks.map((b) => b.weekday)}::smallint[],
            ${blocks.map((b) => b.startMinutes)}::smallint[],
            ${blocks.map((b) => b.durationMinutes)}::smallint[],
            ${blocks.map((b) => b.kind)}::"block_kind"[],
            ${blocks.map((b) => b.title ?? null)}::text[]
          ) AS t("id", "weekday", "startMinutes", "durationMinutes", "kind", "title")
          ON CONFLICT ("id") DO UPDATE SET
            "weekday" = EXCLUDED."weekday",
            "startMinutes" = EXCLUDED."startMinutes",
            "durationMinutes" = EXCLUDED."durationMinutes",
            "kind" = EXCLUDED."kind",
            "title" = EXCLUDED."title"
          WHERE "routine_block"."userId" = EXCLUDED."userId"
          RETURNING "id"`;
        if (returnedIds.parse(rows).length === blocks.length) return;
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
      return c.json({ blocks });
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
