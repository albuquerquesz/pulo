import { decideProposal } from '@pulo/core/api/proposal-decision';
import { checkProposalTransition } from '@pulo/core/api/proposal-state';
import {
  type GenerateProposalResponse,
  generateProposalBodySchema,
  idParamSchema,
  proposalDecisionBodySchema,
  weeklyProposalSchema,
} from '@pulo/core/api/schemas';
import { WEEKLY_AI } from '@pulo/core/config/decisions';
import { addDays, dateKeyOf, weekStartOf } from '@pulo/core/domain/day';
import { generateWeeklyProposal } from '@pulo/core/domain/ia/propose';
import { Prisma, dateKeyToDate, routineBlockMapper, weeklyProposalMapper } from '@pulo/db';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  ApiError,
  type AppEnv,
  type RouteDeps,
  assertNotInFuture,
  jsonBody,
  pathParams,
  requireMatch,
  requireSession,
  sameValue,
} from '../http';
import { summaryFromRows, weekSummaryReads } from '../queries';
import { blockSelect, proposalSelect } from '../selects';

const returnedIds = z.array(z.object({ id: z.string() }));

/** Propostas semanais: `/api/proposals`. A máquina de estados fica em @pulo/core/api/proposal-state. */
export function proposalRoutes({ auth, db, now, ai, newId }: RouteDeps) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/', async (c) => {
      const rows = await db.weeklyProposal.findMany({
        where: { userId: c.var.user.id },
        select: proposalSelect,
        orderBy: { weekStart: 'desc' },
      });
      return c.json({ proposals: rows.map(weeklyProposalMapper.toDomain) });
    })
    // Gera (ou devolve) a proposta da semana no servidor. Queries fixas: 6 leituras numa transação (4 do resumo, blocos,
    // propostas da janela da quarentena) e 1 INSERT, qualquer que seja a quantidade de dados. A IA só vê o resumo agregado.
    .post('/generate', jsonBody(generateProposalBodySchema), async (c) => {
      const { id: userId, metadata } = c.var.user;
      const serverNow = now();
      const weekStart = weekStartOf(c.req.valid('json').date ?? dateKeyOf(serverNow, metadata.timezone));
      const oldest = dateKeyToDate(addDays(weekStart, -7 * WEEKLY_AI.deniedCooldownWeeks));

      const [sessions, restDays, habitLogs, blockRows, proposalRows] = await db.$transaction([
        ...weekSummaryReads(db, userId, metadata.timezone, weekStart),
        db.routineBlock.findMany({ where: { userId }, select: blockSelect }),
        db.weeklyProposal.findMany({
          where: { userId, weekStart: { gte: oldest, lte: dateKeyToDate(weekStart) } },
          select: proposalSelect,
        }),
      ]);

      const outcome = await generateWeeklyProposal({
        summary: summaryFromRows(weekStart, metadata.timezone, { sessions, restDays, habitLogs }),
        blocks: blockRows.map(routineBlockMapper.toDomain),
        proposals: proposalRows.map(weeklyProposalMapper.toDomain),
        client: ai.client,
        now: serverNow,
        newId: () => newId(serverNow),
        timeoutMs: ai.timeoutMs,
      });

      switch (outcome.kind) {
        case 'conhecendo':
        case 'sem_candidata':
          return c.json({ outcome: outcome.kind } satisfies GenerateProposalResponse);
        case 'existente':
          return c.json({ outcome: 'existente', proposal: outcome.proposal } satisfies GenerateProposalResponse);
        case 'proposta': {
          if (outcome.fallbackReason !== undefined) console.warn('proposta_ia_fallback', outcome.fallbackReason);
          try {
            const row = await db.weeklyProposal.create({
              data: weeklyProposalMapper.fromDomain(userId, outcome.proposal),
              select: proposalSelect,
            });
            return c.json({ outcome: 'proposta', proposal: weeklyProposalMapper.toDomain(row) } satisfies GenerateProposalResponse);
          } catch (error) {
            // Duas gerações ao mesmo tempo: a outra venceu a semana (índice único). Devolve a dela, sem criar de novo.
            if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
            const winner = await db.weeklyProposal.findUnique({
              where: { userId_weekStart: { userId, weekStart: dateKeyToDate(weekStart) } },
              select: proposalSelect,
            });
            if (!winner) throw error;
            return c.json({ outcome: 'existente', proposal: weeklyProposalMapper.toDomain(winner) } satisfies GenerateProposalResponse);
          }
        }
      }
    })
    // Decisão sobre a proposta: máquina de estados e blocos na MESMA transação (serializável). Queries: 2 da sessão, proposta,
    // blocos, UM UPDATE dos blocos (aceitar, editar, desfazer) e o da proposta. Negar não mexe nos blocos.
    .post('/:id/decision', pathParams(idParamSchema), jsonBody(proposalDecisionBodySchema), async (c) => {
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      const userId = c.var.user.id;
      const serverNow = now();

      const done = await db.$transaction(
        async (tx) => {
          const row = await tx.weeklyProposal.findUnique({ where: { id_userId: { id, userId } }, select: proposalSelect });
          if (!row) throw new ApiError(404, 'nao_encontrado', 'Não encontrei essa sugestão.');
          const blockRows = await tx.routineBlock.findMany({
            where: { userId },
            select: blockSelect,
            orderBy: [{ weekday: 'asc' }, { startMinutes: 'asc' }],
          });
          const result = decideProposal(weeklyProposalMapper.toDomain(row), blockRows.map(routineBlockMapper.toDomain), body, serverNow);
          if (!result.ok) {
            const { code, message } = result.failure;
            throw new ApiError(code === 'corpo_invalido' ? 400 : 409, code, message);
          }
          if (!result.changed) return result;

          if (result.writes.length > 0) {
            const { writes } = result;
            const updated = await tx.$queryRaw`
              UPDATE "routine_block" AS b SET
                "weekday" = t."weekday", "startMinutes" = t."startMinutes", "durationMinutes" = t."durationMinutes"
              FROM unnest(
                ${writes.map((w) => w.block.id)}::text[],
                ${writes.map((w) => w.block.weekday)}::smallint[],
                ${writes.map((w) => w.block.startMinutes)}::smallint[],
                ${writes.map((w) => w.block.durationMinutes)}::smallint[],
                ${writes.map((w) => w.expected.weekday)}::smallint[],
                ${writes.map((w) => w.expected.startMinutes)}::smallint[],
                ${writes.map((w) => w.expected.durationMinutes)}::smallint[]
              ) AS t("id", "weekday", "startMinutes", "durationMinutes", "oldWeekday", "oldStart", "oldDuration")
              WHERE b."id" = t."id" AND b."userId" = ${userId}
                AND b."weekday" = t."oldWeekday" AND b."startMinutes" = t."oldStart" AND b."durationMinutes" = t."oldDuration"
              RETURNING b."id"`;
            if (returnedIds.parse(updated).length !== writes.length) {
              throw new ApiError(409, 'bloco_mudou', 'Seu bloco mudou desde que a ideia foi feita. Atualize a semana para ver uma nova.');
            }
          }
          const { id: _id, userId: _owner, ...data } = weeklyProposalMapper.fromDomain(userId, result.proposal);
          const saved = await tx.weeklyProposal.update({ where: { id_userId: { id, userId } }, data, select: proposalSelect });
          return { ...result, proposal: weeklyProposalMapper.toDomain(saved) };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return c.json({ proposal: done.proposal, blocks: done.blocks });
    })
    .put('/:id', pathParams(idParamSchema), jsonBody(weeklyProposalSchema), async (c) => {
      const proposal = c.req.valid('json');
      requireMatch(c.req.valid('param').id, proposal.id, 'id_divergente');
      const serverNow = now();
      assertNotInFuture(proposal.createdAt, serverNow, 'createdAt');
      assertNotInFuture(proposal.decidedAt, serverNow, 'decidedAt');
      const userId = c.var.user.id;

      const saved = await db.$transaction(async (tx) => {
        // Uma query: a própria proposta e a que já ocupa a semana (uma por pessoa e semana).
        const rows = await tx.weeklyProposal.findMany({
          where: { userId, OR: [{ id: proposal.id }, { weekStart: dateKeyToDate(proposal.weekStart) }] },
          select: proposalSelect,
        });
        const existing = rows.find((row) => row.id === proposal.id);
        if (rows.some((row) => row.id !== proposal.id)) {
          throw new ApiError(409, 'semana_ja_tem_proposta', 'Esta semana já tem uma proposta.');
        }
        if (existing) {
          const current = weeklyProposalMapper.toDomain(existing);
          const problem = checkProposalTransition(current, proposal, serverNow, sameValue);
          if (problem === 'proposta_imutavel') {
            throw new ApiError(409, problem, 'Semana, origem e criação da proposta não mudam.');
          }
          if (problem !== null) throw new ApiError(409, problem, 'Esta mudança de estado não é permitida.');
          if (current.state === proposal.state && current.state !== 'pendente') return current;
        }
        const { id: _id, userId: _owner, ...update } = weeklyProposalMapper.fromDomain(userId, proposal);
        const row = await tx.weeklyProposal.upsert({
          where: { id_userId: { id: proposal.id, userId } },
          create: weeklyProposalMapper.fromDomain(userId, proposal),
          update,
          select: proposalSelect,
        });
        return weeklyProposalMapper.toDomain(row);
      });
      return c.json({ proposal: saved });
    });
}
