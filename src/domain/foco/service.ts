import { FOCUS } from '@/config/decisions';
import { sessionCountsAsCare } from '../care-days';
import { newId } from '../ids';
import { refreshMascotState, type MascotRefresh } from '../phase';
import type { Clock, EntityId, FocusSession, Repository } from '../types';
import {
  interruptSession,
  isValidPlannedMinutes,
  pauseSession,
  reconcileSession,
  resumeSession,
  startSession,
} from './timer';

/** Eventos para o barramento do sapo (spec 03). Esta camada só os devolve. */
export type FocoEvent = 'bloco_concluido' | 'marco';

export type FocoErrorCode = 'duracao_invalida' | 'sessao_em_andamento' | 'sem_sessao';
export interface FocoError {
  code: FocoErrorCode;
  message: string;
}

export interface FocoOutcome {
  session: FocusSession;
  /** A sessão acabou nesta chamada. */
  ended: boolean;
  /** Encerrou por tempo enquanto o app estava fora ("Você concluiu enquanto estava fora"). */
  concludedWhileAway: boolean;
  countsAsCare: boolean;
  events: FocoEvent[];
  mascot: MascotRefresh | null;
}

export type FocoResult = { ok: true; value: FocoOutcome } | { ok: false; error: FocoError };

async function findActive(repo: Repository): Promise<FocusSession | null> {
  const sessions = await repo.listSessions();
  return sessions.find((s) => s.state === 'em_andamento') ?? null;
}

async function persist(
  repo: Repository,
  session: FocusSession,
  timeZone: string,
  now: number,
  awayFlag: boolean,
): Promise<FocoOutcome> {
  await repo.saveSession(session);
  if (session.state === 'em_andamento') {
    return { session, ended: false, concludedWhileAway: false, countsAsCare: false, events: [], mascot: null };
  }
  const mascot = await refreshMascotState(repo, timeZone, now);
  const events: FocoEvent[] = [];
  if (session.state === 'concluida') events.push('bloco_concluido');
  if (mascot.phaseChanged) events.push('marco');
  return {
    session,
    ended: true,
    concludedWhileAway: awayFlag && session.state === 'concluida',
    countsAsCare: sessionCountsAsCare(session),
    events,
    mascot,
  };
}

/** Sessão em andamento, já reconciliada com o relógio. Se o tempo acabou, conclui e persiste. */
export async function carregarSessaoAtiva(repo: Repository, clock: Clock, timeZone: string): Promise<FocoOutcome | null> {
  const active = await findActive(repo);
  if (!active) return null;
  const now = clock.now();
  const reconciled = reconcileSession(active, now);
  return persist(repo, reconciled, timeZone, now, reconciled !== active);
}

export async function iniciarFoco(
  repo: Repository,
  clock: Clock,
  timeZone: string,
  opts: { plannedMinutes?: number; blockId?: EntityId } = {},
): Promise<FocoResult> {
  const minutes = opts.plannedMinutes ?? FOCUS.defaultMinutes;
  if (!isValidPlannedMinutes(minutes)) {
    return { ok: false, error: { code: 'duracao_invalida', message: `O foco vai de ${FOCUS.minMinutes} a ${FOCUS.maxMinutes} minutos.` } };
  }
  // Se a sessão antiga já acabou pelo relógio, fecha antes de recusar.
  const stale = await carregarSessaoAtiva(repo, clock, timeZone);
  if (stale && !stale.ended) {
    return { ok: false, error: { code: 'sessao_em_andamento', message: 'Já existe um foco em andamento.' } };
  }
  const now = clock.now();
  const session = startSession(newId(now, 'sessao'), now, minutes, opts.blockId);
  return { ok: true, value: await persist(repo, session, timeZone, now, false) };
}

async function mutate(
  repo: Repository,
  clock: Clock,
  timeZone: string,
  change: (s: FocusSession, now: number) => FocusSession,
): Promise<FocoResult> {
  const active = await findActive(repo);
  if (!active) return { ok: false, error: { code: 'sem_sessao', message: 'Nenhum foco em andamento.' } };
  const now = clock.now();
  const reconciled = reconcileSession(active, now);
  if (reconciled !== active) {
    return { ok: true, value: await persist(repo, reconciled, timeZone, now, true) };
  }
  return { ok: true, value: await persist(repo, change(active, now), timeZone, now, false) };
}

export const pausarFoco = (repo: Repository, clock: Clock, timeZone: string) =>
  mutate(repo, clock, timeZone, pauseSession);

export const retomarFoco = (repo: Repository, clock: Clock, timeZone: string) =>
  mutate(repo, clock, timeZone, resumeSession);

/** Parar por agora. Conta como cuidado se o tempo efetivo for >= a fração mínima. */
export const interromperFoco = (repo: Repository, clock: Clock, timeZone: string) =>
  mutate(repo, clock, timeZone, interruptSession);

/** Chame quando o tempo parecer ter acabado: conclui só se o relógio confirma; senão não muda nada. */
export const concluirFoco = (repo: Repository, clock: Clock, timeZone: string) =>
  mutate(repo, clock, timeZone, (s) => s);
