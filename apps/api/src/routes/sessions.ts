import { dateRangeQuerySchema, focusSessionSchema, idParamSchema } from '@pulo/core/api/schemas';
import type { FocusSession } from '@pulo/core/domain/types';
import { focusSessionMapper } from '@pulo/db';
import { Hono } from 'hono';
import { unlockAchievements } from '../achievements';
import {
  ApiError,
  type AppEnv,
  type RouteDeps,
  assertNotInFuture,
  jsonBody,
  pathParams,
  queryParams,
  requireMatch,
  requireSession,
  sameValue,
} from '../http';
import { readMascot, refreshMascot, sessionRangeWhere } from '../queries';
import { sessionSelect } from '../selects';

/** Sessões de foco: `/api/sessions`. Encerrada é imutável; uma só em andamento por pessoa. */
export function sessionRoutes({ auth, db, now }: RouteDeps) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/', queryParams(dateRangeQuerySchema), async (c) => {
      const { id, metadata } = c.var.user;
      const rows = await db.focusSession.findMany({
        where: sessionRangeWhere(id, c.req.valid('query'), metadata.timezone),
        select: sessionSelect,
        orderBy: { startedAt: 'asc' },
      });
      return c.json({ sessions: rows.map(focusSessionMapper.toDomain) });
    })
    .put('/:id', pathParams(idParamSchema), jsonBody(focusSessionSchema), async (c) => {
      const session = c.req.valid('json');
      requireMatch(c.req.valid('param').id, session.id, 'id_divergente');
      const serverNow = now();
      assertNotInFuture(session.startedAt, serverNow, 'startedAt');
      assertNotInFuture(session.endedAt, serverNow, 'endedAt');
      assertNotInFuture(session.pausedSince, serverNow, 'pausedSince');
      const { id: userId, metadata } = c.var.user;

      const result = await db.$transaction(async (tx) => {
        // Uma query traz a sessão (se existir) e a que está em andamento (no máximo uma).
        const rows = await tx.focusSession.findMany({
          where: { userId, OR: [{ id: session.id }, { state: 'em_andamento' }] },
          select: sessionSelect,
        });
        const existing = rows.find((row) => row.id === session.id);
        const otherActive = rows.some((row) => row.id !== session.id && row.state === 'em_andamento');

        if (existing) {
          const current = focusSessionMapper.toDomain(existing);
          if (current.state !== 'em_andamento') {
            if (sameValue(current, session)) return { session: current, mascot: await readMascot(tx, userId) };
            throw new ApiError(409, 'sessao_encerrada', 'Uma sessão encerrada não pode mudar.');
          }
          if (changedIdentity(current, session)) {
            throw new ApiError(409, 'sessao_imutavel', 'Início, duração planejada e bloco não mudam depois de criada.');
          }
        } else {
          if (session.state === 'em_andamento' && otherActive) {
            throw new ApiError(409, 'sessao_em_andamento', 'Já existe um foco em andamento.');
          }
          if (session.blockId !== undefined) {
            const owned = await tx.routineBlock.count({ where: { id: session.blockId, userId } });
            if (owned === 0) throw new ApiError(404, 'referencia_inexistente', 'O bloco não existe.');
          }
        }

        const { id: _id, userId: _owner, ...update } = focusSessionMapper.fromDomain(userId, session);
        const row = await tx.focusSession.upsert({
          where: { id_userId: { id: session.id, userId } },
          create: focusSessionMapper.fromDomain(userId, session),
          update,
          select: sessionSelect,
        });
        const saved = focusSessionMapper.toDomain(row);
        // Encerrar pode criar um dia de cuidado: o sapo é recalculado na mesma transação.
        const mascot = saved.state === 'em_andamento' ? null : await refreshMascot(tx, userId, metadata.timezone, serverNow);
        return { session: saved, mascot };
      });
      // Só uma sessão encerrada muda sequência ou foco.
      const newAchievements = result.session.state === 'em_andamento' ? [] : await unlockAchievements(db, c.var.user, serverNow);
      return c.json({ ...result, newAchievements });
    });
}

function changedIdentity(current: FocusSession, next: FocusSession): boolean {
  return (
    current.startedAt !== next.startedAt ||
    current.plannedMinutes !== next.plannedMinutes ||
    current.blockId !== next.blockId
  );
}
