import { type FocusSessionInput, dateRangeQuerySchema, focusSessionInputSchema, idParamSchema } from '@pulo/core/api/schemas';
import { validarRegistroDeFoco } from '@pulo/core/domain/foco/rules';
import { LINK_KEYS, type FocusLink, linkOf } from '@pulo/core/domain/foco/targets';
import type { FocusSession } from '@pulo/core/domain/types';
import { Prisma, focusSessionMapper } from '@pulo/db';
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
        // Uma query traz a sessão (se existir), a que está em andamento (no máximo uma) e as que cruzam com este horário.
        const cruzam = { startedAt: { lt: new Date(body.endedAt ?? serverNow) }, endedAt: { gt: new Date(body.startedAt) } };
        const rows = await tx.focusSession.findMany({
          where: { userId, OR: [{ id: body.id }, { state: 'em_andamento' }, cruzam] },
          select: sessionSelect,
        });
        const existing = rows.find((row) => row.id === body.id);
        const otherActive = rows.some((row) => row.id !== body.id && row.state === 'em_andamento');
        const others = rows.filter((row) => row.id !== body.id).map(focusSessionMapper.toDomain);
        const current = existing ? focusSessionMapper.toDomain(existing) : undefined;
        const linked = await ownLink(tx, userId, current, applyInput(current, body));
        const session = await releaseDeletedBlock(tx, current, linked);

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

        const valida = validarRegistroDeFoco({ session, nova: !current, outras: others, now: serverNow });
        if (!valida.ok) throw new ApiError(409, valida.error.code, valida.error.message);

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
      // Serializável: duas sessões que se cruzam não passam juntas pela conferência (a perdedora recebe 409).
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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

/**
 * Bloco apagado com o foco já gravado (o banco soltou a sessão): o pedido de um aparelho que ainda cita o bloco
 * segue sem ele, para o foco não se perder.
 */
async function releaseDeletedBlock(tx: Client, current: FocusSession | undefined, next: FocusSession): Promise<FocusSession> {
  if (!current || current.blockId !== undefined || next.blockId === undefined) return next;
  if ((await tx.routineBlock.count({ where: { id: next.blockId } })) > 0) return next;
  const { blockId: _gone, ...rest } = next;
  return rest;
}

function changedIdentity(current: FocusSession, next: FocusSession): boolean {
  return (
    current.startedAt !== next.startedAt ||
    current.plannedMinutes !== next.plannedMinutes ||
    current.blockId !== next.blockId
  );
}
