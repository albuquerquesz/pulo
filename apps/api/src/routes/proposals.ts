import { idParamSchema, weeklyProposalSchema } from '@pulo/core/api/schemas';
import { checkProposalTransition } from '@pulo/core/api/proposal-state';
import { weeklyProposalMapper, dateKeyToDate } from '@pulo/db';
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
import { proposalSelect } from '../selects';

/** Propostas semanais: `/api/proposals`. A máquina de estados fica em @pulo/core/api/proposal-state. */
export function proposalRoutes({ auth, db, now }: RouteDeps) {
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
