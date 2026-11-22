import { INTERRUPTED_SESSION_MIN_RATIO } from '../config/decisions';
import { dateKeyOf } from './day';
import type { DateKey, FocusSession, RestDay } from './types';

/** Tempo efetivo de foco de uma sessão encerrada (sem as pausas), em ms. */
export function effectiveMs(session: FocusSession): number {
  if (session.endedAt === undefined) return 0;
  return Math.max(0, session.endedAt - session.startedAt - session.pausedMs);
}

/** Conta como cuidado: concluída, ou interrompida com tempo efetivo >= a fração mínima do planejado. */
export function sessionCountsAsCare(session: FocusSession): boolean {
  if (session.state === 'concluida') return true;
  if (session.state === 'interrompida') {
    return effectiveMs(session) >= session.plannedMinutes * 60_000 * INTERRUPTED_SESSION_MIN_RATIO;
  }
  return false;
}

/** Dia lógico de uma sessão encerrada (pelo instante em que terminou). */
export function sessionDateKey(session: FocusSession, timeZone: string): DateKey {
  return dateKeyOf(session.endedAt ?? session.startedAt, timeZone);
}

/** Datas distintas de cuidado, ordenadas. Calculado, nunca gravado. */
export function careDayKeys(
  sessions: readonly FocusSession[],
  restDays: readonly RestDay[],
  timeZone: string,
): DateKey[] {
  const set = new Set<DateKey>();
  for (const s of sessions) if (sessionCountsAsCare(s)) set.add(sessionDateKey(s, timeZone));
  for (const r of restDays) set.add(r.date);
  return [...set].sort();
}

export function countCareDays(
  sessions: readonly FocusSession[],
  restDays: readonly RestDay[],
  timeZone: string,
): number {
  return careDayKeys(sessions, restDays, timeZone).length;
}
