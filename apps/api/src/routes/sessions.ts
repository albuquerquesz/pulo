import { type FocusSessionInput, dateRangeQuerySchema, focusSessionInputSchema, idParamSchema } from '@pulo/core/api/schemas';
import { LINK_KEYS, type FocusLink, linkOf } from '@pulo/core/domain/foco/targets';
import type { FocusSession } from '@pulo/core/domain/types';
import { focusSessionMapper } from '@pulo/db';
import { Hono } from 'hono';
import { unlockAchievements } from '../achievements';
import {
  ApiError,
  type AppEnv,
  type Client,
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
    .put('/:id', pathParams(idParamSchema), jsonBody(focusSessionInputSchema), async (c) => {
      const body = c.req.valid('json');
      requireMatch(c.req.valid('param').id, body.id, 'id_divergente');
      const serverNow = now();
      assertNotInFuture(body.startedAt, serverNow, 'startedAt');
      assertNotInFuture(body.endedAt, serverNow, 'endedAt');
      assertNotInFuture(body.pausedSince, serverNow, 'pausedSince');
      const { id: userId, metadata } = c.var.user;

      const result = await db.$transaction(async (tx) => {
        // Uma query traz a sessão (se existir) e a que está em andamento (no máximo uma).
        const rows = await tx.focusSession.findMany({
          where: { userId, OR: [{ id: body.id }, { state: 'em_andamento' }] },
          select: sessionSelect,
        });
        const existing = rows.find((row) => row.id === body.id);
        const otherActive = rows.some((row) => row.id !== body.id && row.state === 'em_andamento');
        const current = existing ? focusSessionMapper.toDomain(existing) : undefined;
        const session = await ownLink(tx, userId, current, applyInput(current, body));

        if (current) {
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

/** A sessão que o corpo pede: intenção e vínculo omitidos ficam os gravados, `null` limpa e um alvo novo troca o anterior. */
function applyInput(current: FocusSession | undefined, body: FocusSessionInput): FocusSession {
  const { intention, habitId, goalId, taskId, ...rest } = body;
  const sent = { habitId, goalId, taskId };
  const replaces = LINK_KEYS.some((key) => typeof sent[key] === 'string');
  const link: FocusLink = {};
  for (const key of LINK_KEYS) {
    const value = replaces || sent[key] === null ? sent[key] : current?.[key];
    if (typeof value === 'string') link[key] = value;
  }
  const text = intention === undefined ? current?.intention : intention;
  return { ...rest, ...link, ...(typeof text === 'string' ? { intention: text } : {}) };
}

const TARGETS = {
  habitId: { missing: 'O hábito não existe.', owner: (tx: Client, id: string) => tx.habit.findUnique({ where: { id }, select: { userId: true } }) },
  goalId: { missing: 'A meta não existe.', owner: (tx: Client, id: string) => tx.goal.findUnique({ where: { id }, select: { userId: true } }) },
  taskId: { missing: 'A tarefa não existe.', owner: (tx: Client, id: string) => tx.task.findUnique({ where: { id }, select: { userId: true } }) },
} as const;

/**
 * Confere o dono de um vínculo novo (no máximo uma query). Alvo de outra pessoa: 404. Alvo que não existe: 404 numa sessão
 * nova; numa que já existe (apagado em outro aparelho) o pedido segue com o vínculo gravado, para o foco não se perder.
 */
async function ownLink(tx: Client, userId: string, current: FocusSession | undefined, next: FocusSession): Promise<FocusSession> {
  const key = LINK_KEYS.find((candidate) => next[candidate] !== undefined);
  const id = key && next[key];
  if (!key || !id || current?.[key] === id) return next;
  const row = await TARGETS[key].owner(tx, id);
  if (row?.userId === userId) return next;
  if (row || !current) throw new ApiError(404, 'referencia_inexistente', TARGETS[key].missing);
  const { habitId: _habit, goalId: _goal, taskId: _task, ...rest } = next;
  return { ...rest, ...linkOf(current) };
}

function changedIdentity(current: FocusSession, next: FocusSession): boolean {
  return (
    current.startedAt !== next.startedAt ||
    current.plannedMinutes !== next.plannedMinutes ||
    current.blockId !== next.blockId
  );
}
