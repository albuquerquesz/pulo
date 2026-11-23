import { checkProposalTransition } from '@pulo/core/api/proposal-state';
import {
  type GenerateProposalResponse,
  generateProposalBodySchema,
  idParamSchema,
  weeklyProposalSchema,
} from '@pulo/core/api/schemas';
import { WEEKLY_AI } from '@pulo/core/config/decisions';
import { addDays, dateKeyOf, weekStartOf } from '@pulo/core/domain/day';
import { generateWeeklyProposal } from '@pulo/core/domain/ia/propose';
import { Prisma, dateKeyToDate, routineBlockMapper, weeklyProposalMapper } from '@pulo/db';
import { Hono } from 'hono';
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

      const [sessions, checkIns, restDays, habitLogs, blockRows, proposalRows] = await db.$transaction([
        ...weekSummaryReads(db, userId, metadata.timezone, weekStart),
        db.routineBlock.findMany({ where: { userId }, select: blockSelect }),
        db.weeklyProposal.findMany({
          where: { userId, weekStart: { gte: oldest, lte: dateKeyToDate(weekStart) } },
          select: proposalSelect,
        }),
      ]);

      const outcome = await generateWeeklyProposal({
        summary: summaryFromRows(weekStart, metadata.timezone, { sessions, checkIns, restDays, habitLogs }),
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
