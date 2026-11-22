import { INTERRUPTED_SESSION_MIN_RATIO, PHASE_MIN_CARE_DAYS } from '@/config/decisions';
import type { FocusSession, Phase, RestDay } from '@/domain/types';
import { dateKeyOf } from './time';

/**
 * Contagem simples de dias de cuidado, só para o demo e seus testes.
 * A regra oficial vive em src/domain (spec 01); isto a espelha de forma mínima.
 */
export function countCareDays(sessions: FocusSession[], restDays: RestDay[]): number {
  const days = new Set<string>(restDays.map((r) => r.date));
  for (const s of sessions) {
    if (s.endedAt === undefined) continue;
    const effective = s.endedAt - s.startedAt - s.pausedMs;
    const counts =
      s.state === 'concluida' ||
      (s.state === 'interrompida' && effective >= s.plannedMinutes * 60_000 * INTERRUPTED_SESSION_MIN_RATIO);
    if (counts) days.add(dateKeyOf(s.startedAt));
  }
  return days.size;
}

export function phaseForCareDays(careDays: number): Phase {
  const phases: Phase[] = [4, 3, 2, 1];
  return phases.find((p) => careDays >= PHASE_MIN_CARE_DAYS[p]) ?? 1;
}
