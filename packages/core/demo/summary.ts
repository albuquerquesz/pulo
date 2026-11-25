import { PERIODS } from '../config/decisions';
import { focusByTarget } from '../domain/foco/targets';
import type { FocusSession, Period, RestDay, WeekSummary } from '../domain/types';
import { countCareDays } from './careDays';
import { addDays, dateKeyOf } from './time';

function periodOfMs(ms: number): Period | null {
  const hour = Math.floor((((ms / 60_000 - 180) % 1440) + 1440) % 1440 / 60);
  for (const p of ['manha', 'tarde', 'noite'] as const) {
    if (hour >= PERIODS[p].startHour && hour < PERIODS[p].endHour) return p;
  }
  return null;
}

/**
 * Resumo mínimo da semana, só para validar o demo e a IA em testes sem depender de src/domain.
 * A versão oficial é a da spec 01.
 */
export function summarizeDemoWeek(
  weekStart: string,
  sessions: FocusSession[],
  restDays: RestDay[],
  stableMinCareDays: number,
): WeekSummary {
  const weekEnd = addDays(weekStart, 6);
  const inWeek = (d: string) => d >= weekStart && d <= weekEnd;
  const zero = () => ({ manha: 0, tarde: 0, noite: 0 });
  const focus = zero();
  const done = zero();
  const stopped = zero();
  const days = new Set<string>();
  const wSessions = sessions.filter((s) => inWeek(dateKeyOf(s.startedAt)) && s.state !== 'em_andamento');
  for (const s of wSessions) {
    days.add(dateKeyOf(s.startedAt));
    const p = periodOfMs(s.startedAt);
    if (!p) continue;
    if (s.state === 'concluida') {
      done[p]++;
      focus[p] += s.plannedMinutes;
    } else stopped[p]++;
  }
  const wRest = restDays.filter((r) => inWeek(r.date));
  wRest.forEach((r) => days.add(r.date));
  const careDays = countCareDays(wSessions, wRest);
  const stats = (p: Period) => ({
    completed: done[p],
    interrupted: stopped[p],
    completionRate: done[p] + stopped[p] ? done[p] / (done[p] + stopped[p]) : null,
  });
  return {
    weekStart,
    weekEnd,
    focusMinutesByPeriod: focus,
    sessionsByPeriod: { manha: stats('manha'), tarde: stats('tarde'), noite: stats('noite') },
    totalSessions: wSessions.length,
    restDays: wRest.length,
    careDays,
    daysWithRecord: days.size,
    stable: careDays >= stableMinCareDays,
    focoPorAlvo: focusByTarget(wSessions),
    sessoesTerminadas: wSessions.filter((s) => s.state === 'concluida').length,
    sessoesLargadas: wSessions.filter((s) => s.state === 'interrompida').length,
    melhorPeriodo:
      (['manha', 'tarde', 'noite'] as const).filter((p) => focus[p] > 0).sort((a, b) => focus[b] - focus[a])[0] ?? null,
  };
}
