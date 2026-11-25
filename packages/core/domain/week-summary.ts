import { STABLE_WEEK_MIN_CARE_DAYS } from '../config/decisions';
import { effectiveMs, sessionCountsAsCare, sessionDateKey } from './care-days';
import { focusByTarget } from './foco/targets';
import { periodOf, weekDates, weekEndOf, weekStartOf } from './day';
import type {
  DateKey,
  FocusSession,
  HabitLog,
  Period,
  PeriodSessionStats,
  Repository,
  RestDay,
  WeekSummary,
} from './types';

const PERIOD_LIST: Period[] = ['manha', 'tarde', 'noite'];

function perPeriod<T>(make: () => T): Record<Period, T> {
  return { manha: make(), tarde: make(), noite: make() };
}

export interface WeekSummaryInput {
  /** Qualquer data da semana: o resumo usa a segunda-feira correspondente. */
  weekStart: DateKey;
  timeZone: string;
  sessions: readonly FocusSession[];
  restDays: readonly RestDay[];
  habitLogs?: readonly HabitLog[];
}

/**
 * Resumo agregado da semana (segunda a domingo, dia lógico). Só números:
 * nunca inclui títulos, nomes nem texto livre.
 */
export function buildWeekSummary(input: WeekSummaryInput): WeekSummary {
  const { timeZone } = input;
  const weekStart = weekStartOf(input.weekStart);
  const weekEnd = weekEndOf(weekStart);
  const days = new Set(weekDates(weekStart));

  const minutesMs = perPeriod(() => 0);
  const sessionStats = perPeriod(() => ({ completed: 0, interrupted: 0 }));
  const record = new Set<DateKey>();
  const care = new Set<DateKey>();
  let totalSessions = 0;
  const counted: FocusSession[] = [];

  for (const s of input.sessions) {
    if (s.state === 'em_andamento') continue;
    const key = sessionDateKey(s, timeZone);
    if (!days.has(key)) continue;
    const period = periodOf(s.startedAt, timeZone);
    record.add(key);
    counted.push(s);
    totalSessions += 1;
    minutesMs[period] += effectiveMs(s);
    if (s.state === 'concluida') sessionStats[period].completed += 1;
    else sessionStats[period].interrupted += 1;
    if (sessionCountsAsCare(s)) care.add(key);
  }

  const rest = new Set<DateKey>();
  for (const r of input.restDays) {
    if (!days.has(r.date)) continue;
    rest.add(r.date);
    record.add(r.date);
    care.add(r.date);
  }
  for (const h of input.habitLogs ?? []) if (days.has(h.date)) record.add(h.date);

  const sessionsByPeriod = {} as Record<Period, PeriodSessionStats>;
  const focusMinutesByPeriod = {} as Record<Period, number>;
  for (const p of PERIOD_LIST) {
    const { completed, interrupted } = sessionStats[p];
    const total = completed + interrupted;
    sessionsByPeriod[p] = { completed, interrupted, completionRate: total === 0 ? null : completed / total };
    focusMinutesByPeriod[p] = Math.round(minutesMs[p] / 60_000);
  }

  // Empate: mais sessões concluídas e, ainda assim, o período mais cedo.
  const [best] = [...PERIOD_LIST].sort(
    (a, b) => minutesMs[b] - minutesMs[a] || sessionStats[b].completed - sessionStats[a].completed,
  );

  return {
    weekStart,
    weekEnd,
    focusMinutesByPeriod,
    sessionsByPeriod,
    totalSessions,
    restDays: rest.size,
    careDays: care.size,
    daysWithRecord: record.size,
    stable: care.size >= STABLE_WEEK_MIN_CARE_DAYS,
    focoPorAlvo: focusByTarget(counted),
    sessoesTerminadas: PERIOD_LIST.reduce((n, p) => n + sessionStats[p].completed, 0),
    sessoesLargadas: PERIOD_LIST.reduce((n, p) => n + sessionStats[p].interrupted, 0),
    melhorPeriodo: best !== undefined && minutesMs[best] > 0 ? best : null,
  };
}

/** Atalho: resume a semana de uma data a partir do repositório. */
export async function loadWeekSummary(
  repo: Repository,
  anyDateInWeek: DateKey,
  timeZone: string,
): Promise<WeekSummary> {
  const weekStart = weekStartOf(anyDateInWeek);
  const range = { from: weekStart, to: weekEndOf(weekStart) };
  const [sessions, restDays, habitLogs] = await Promise.all([
    repo.listSessions(),
    repo.listRestDays(),
    repo.listHabitLogs(range),
  ]);
  return buildWeekSummary({ weekStart, timeZone, sessions, restDays, habitLogs });
}
