import type { CheckIn, FocusSession, Period, Energy } from './types';

export const TZ = 'America/Sao_Paulo';

/** Instante para um horário de parede em America/Sao_Paulo (UTC-3, sem horário de verão). Só para testes e dados sintéticos. */
export function sp(year: number, month: number, day: number, hour = 12, minute = 0): number {
  return Date.UTC(year, month - 1, day, hour + 3, minute);
}

let n = 0;
/** Sessão encerrada sintética. `effectiveMinutes` = minutos efetivos de foco. */
export function endedSession(
  startedAt: number,
  plannedMinutes: number,
  state: 'concluida' | 'interrompida',
  effectiveMinutes = plannedMinutes,
  pausedMs = 0,
): FocusSession {
  n += 1;
  return {
    id: `s${n}`,
    startedAt,
    endedAt: startedAt + effectiveMinutes * 60_000 + pausedMs,
    plannedMinutes,
    state,
    pausedMs,
  };
}

export function checkIn(date: string, period: Period, energy: Energy, createdAt = 0): CheckIn {
  n += 1;
  return { id: `c${n}`, date, period, energy, createdAt };
}
