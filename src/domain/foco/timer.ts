import { FOCUS } from '@/config/decisions';
import type { EntityId, FocusSession } from '../types';

/**
 * Máquina do timer, baseada em horário. Nada é contado: o restante vem sempre de
 *   restante = planejado * 60000 - (agora - inicio - pausadoMs)
 * onde pausadoMs inclui a pausa em curso, se houver.
 */
export type TimerState = 'ocioso' | 'rodando' | 'pausado' | 'em_pausa_curta' | 'concluido' | 'interrompido';

export interface ShortBreak {
  startedAt: number;
  minutes: number;
}

export interface TimerSnapshot {
  state: TimerState;
  /** Restante do foco (ou da pausa curta, em `em_pausa_curta`), em ms. */
  remainingMs: number;
  /** Tempo efetivo de foco até agora, em ms. */
  elapsedMs: number;
  /** 0 a 1. */
  progress: number;
}

export function plannedMs(session: FocusSession): number {
  return session.plannedMinutes * 60_000;
}

/** Total pausado até `now`, incluindo a pausa em curso. */
export function pausedTotalMs(session: FocusSession, now: number): number {
  if (session.endedAt !== undefined) return session.pausedMs;
  return session.pausedMs + (session.pausedSince !== undefined ? Math.max(0, now - session.pausedSince) : 0);
}

/** Tempo efetivo de foco até `now` (sem pausas), limitado ao planejado. */
export function elapsedFocusMs(session: FocusSession, now: number): number {
  const end = session.endedAt ?? now;
  const raw = end - session.startedAt - pausedTotalMs(session, end);
  return Math.min(plannedMs(session), Math.max(0, raw));
}

export function remainingMs(session: FocusSession, now: number): number {
  if (session.state === 'concluida') return 0;
  return Math.max(0, plannedMs(session) - elapsedFocusMs(session, now));
}

/** O tempo planejado já acabou (e a sessão ainda está em andamento)? */
export function hasTimeRunOut(session: FocusSession, now: number): boolean {
  return session.state === 'em_andamento' && remainingMs(session, now) <= 0;
}

/** Instante em que o foco termina se ninguém pausar mais: inicio + planejado + pausadoMs. */
export function computedEndAt(session: FocusSession): number {
  return session.startedAt + plannedMs(session) + session.pausedMs;
}

export function isValidPlannedMinutes(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= FOCUS.minMinutes && minutes <= FOCUS.maxMinutes;
}

export function isValidBreakMinutes(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= FOCUS.minBreakMinutes && minutes <= FOCUS.maxBreakMinutes;
}

export function startSession(id: EntityId, now: number, plannedMinutes: number, blockId?: EntityId): FocusSession {
  const session: FocusSession = { id, startedAt: now, plannedMinutes, state: 'em_andamento', pausedMs: 0 };
  if (blockId !== undefined) session.blockId = blockId;
  return session;
}

export function pauseSession(session: FocusSession, now: number): FocusSession {
  if (session.state !== 'em_andamento' || session.pausedSince !== undefined) return session;
  return { ...session, pausedSince: now };
}

export function resumeSession(session: FocusSession, now: number): FocusSession {
  if (session.state !== 'em_andamento' || session.pausedSince === undefined) return session;
  const { pausedSince, ...rest } = session;
  return { ...rest, pausedMs: session.pausedMs + Math.max(0, now - pausedSince) };
}

function closed(session: FocusSession, state: 'concluida' | 'interrompida', endedAt: number): FocusSession {
  const { pausedSince, ...rest } = session;
  const pausedMs = session.pausedMs + (pausedSince !== undefined ? Math.max(0, endedAt - pausedSince) : 0);
  return { ...rest, state, endedAt, pausedMs };
}

/** Conclui no instante calculado (inicio + planejado + pausadoMs), nunca na hora da reabertura. */
export function completeSession(session: FocusSession): FocusSession {
  const { pausedSince, ...rest } = session;
  const pausedMs = session.pausedMs;
  void pausedSince;
  return closed({ ...rest, pausedMs }, 'concluida', session.startedAt + plannedMs(session) + pausedMs);
}

/**
 * Reabertura: se o tempo já acabou, conclui com o fim calculado. Senão devolve a mesma sessão.
 * Uma sessão pausada nunca acaba sozinha (o restante não anda durante a pausa).
 */
export function reconcileSession(session: FocusSession, now: number): FocusSession {
  return hasTimeRunOut(session, now) ? completeSession(session) : session;
}

/** Encerra antes do fim, sem culpa. Se o tempo já tinha acabado, conta como concluída. */
export function interruptSession(session: FocusSession, now: number): FocusSession {
  if (hasTimeRunOut(session, now)) return completeSession(session);
  return closed(session, 'interrompida', now);
}

export function startShortBreak(now: number, minutes: number = FOCUS.defaultBreakMinutes): ShortBreak {
  return { startedAt: now, minutes };
}

export function breakRemainingMs(pausa: ShortBreak, now: number): number {
  return Math.max(0, pausa.minutes * 60_000 - (now - pausa.startedAt));
}

export function timerSnapshot(
  session: FocusSession | null,
  now: number,
  pausa: ShortBreak | null = null,
): TimerSnapshot {
  if (session && session.state === 'em_andamento') {
    const reconciled = reconcileSession(session, now);
    if (reconciled.state === 'concluida') {
      return { state: 'concluido', remainingMs: 0, elapsedMs: plannedMs(session), progress: 1 };
    }
    const elapsed = elapsedFocusMs(session, now);
    return {
      state: session.pausedSince !== undefined ? 'pausado' : 'rodando',
      remainingMs: plannedMs(session) - elapsed,
      elapsedMs: elapsed,
      progress: elapsed / plannedMs(session),
    };
  }
  if (pausa && breakRemainingMs(pausa, now) > 0) {
    return { state: 'em_pausa_curta', remainingMs: breakRemainingMs(pausa, now), elapsedMs: 0, progress: 0 };
  }
  if (session?.state === 'concluida') {
    return { state: 'concluido', remainingMs: 0, elapsedMs: plannedMs(session), progress: 1 };
  }
  if (session?.state === 'interrompida') {
    const elapsed = elapsedFocusMs(session, session.endedAt ?? now);
    return { state: 'interrompido', remainingMs: plannedMs(session) - elapsed, elapsedMs: elapsed, progress: elapsed / plannedMs(session) };
  }
  return { state: 'ocioso', remainingMs: 0, elapsedMs: 0, progress: 0 };
}
