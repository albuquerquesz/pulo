import { PHASE_MIN_CARE_DAYS } from '@/config/decisions';
import { countCareDays } from './care-days';
import type { FocusSession, MascotState, Phase, Repository, RestDay } from './types';

/** Fase pelo total de dias de cuidado (sem olhar o que foi guardado). */
export function phaseForCareDays(careDays: number): Phase {
  if (careDays >= PHASE_MIN_CARE_DAYS[4]) return 4;
  if (careDays >= PHASE_MIN_CARE_DAYS[3]) return 3;
  if (careDays >= PHASE_MIN_CARE_DAYS[2]) return 2;
  return 1;
}

/** Nunca regride: max(guardada, calculada). */
export function resolvePhase(stored: Phase | null | undefined, computed: Phase): Phase {
  return Math.max(stored ?? 1, computed) as Phase;
}

export function computeMascotState(
  sessions: readonly FocusSession[],
  restDays: readonly RestDay[],
  timeZone: string,
  previous: MascotState | null,
  now: number,
): MascotState {
  const computed = countCareDays(sessions, restDays, timeZone);
  return {
    phase: resolvePhase(previous?.phase, phaseForCareDays(computed)),
    // Dias de cuidado também não diminuem em relação ao cache.
    careDays: Math.max(previous?.careDays ?? 0, computed),
    updatedAt: now,
  };
}

export interface MascotRefresh {
  state: MascotState;
  previous: MascotState | null;
  /** A fase subiu nesta atualização (evento `marco`). */
  phaseChanged: boolean;
  /** O total de dias de cuidado aumentou. */
  careDaysChanged: boolean;
}

/** Recalcula pelo repositório, grava o cache e informa o que mudou. */
export async function refreshMascotState(
  repo: Repository,
  timeZone: string,
  now: number,
): Promise<MascotRefresh> {
  const [sessions, restDays, previous] = await Promise.all([
    repo.listSessions(),
    repo.listRestDays(),
    repo.getMascotState(),
  ]);
  const state = computeMascotState(sessions, restDays, timeZone, previous, now);
  await repo.saveMascotState(state);
  return {
    state,
    previous,
    phaseChanged: state.phase > (previous?.phase ?? 1),
    careDaysChanged: state.careDays > (previous?.careDays ?? 0),
  };
}
