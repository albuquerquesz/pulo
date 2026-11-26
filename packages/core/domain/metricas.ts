import { DAY_ROLLOVER_HOUR, DEFAULT_TIMEZONE, METRICAS } from '../config/decisions';
import { MINUTE_MS } from './clock';
import { addDays, dateKeyOf, diffDays, periodOf, weekdayOf } from './day';
import { resumoDoGelo } from './gelo';
import { providesFreezeStore } from './gelo-store';
import { focusedMs, joiasGanhas, listFreezePurchasesOf } from './joias';
import { streakDaySets, streakWeekStart } from './streak';
import type {
  Clock,
  DateKey,
  FocusSession,
  Habit,
  HabitLog,
  Period,
  ProfileMetrics,
  Repository,
  RestDay,
  Vacation,
  Weekday,
} from './types';
import { bestPeriod } from './week-summary';

export type HabitoDasMetricas = Pick<Habit, 'id' | 'weekdays' | 'state'> & {
  /** Dia em que o hábito nasceu. Sem ele, vale o primeiro dia feito. */
  criadoEm?: DateKey;
};

export interface MetricsInput {
  habits: readonly HabitoDasMetricas[];
  habitLogs: readonly Pick<HabitLog, 'habitId' | 'date'>[];
  sessions: readonly FocusSession[];
  restDays: readonly RestDay[];
  vacation?: Vacation;
  gelo: ProfileMetrics['gelo'];
  feitos: ProfileMetrics['feitos'];
  /** Instante em que a conta foi criada. */
  createdAt: number;
  timeZone: string;
  dayStartMinutes?: number;
  now: number;
}

const average = (values: readonly number[]) => values.reduce((total, value) => total + value, 0) / values.length;

/**
 * Compara o foco por semana com e sem descanso. Só entram semanas fechadas, que começaram com a conta já criada e que
 * têm algum registro (uma semana longe do app não diz nada sobre a pausa).
 */
function descansoDasMetricas(input: MetricsInput, today: DateKey, created: DateKey, dayOf: (s: FocusSession) => DateKey) {
  const rests = [...new Set(input.restDays.map((r) => r.date))].filter((date) => date <= today);
  const withRest = new Set(rests.map(streakWeekStart));
  const focus = new Map<DateKey, number>();
  for (const session of input.sessions) {
    if (session.state === 'em_andamento') continue;
    const week = streakWeekStart(dayOf(session));
    focus.set(week, (focus.get(week) ?? 0) + focusedMs(session));
  }
  const recorded = new Set([...withRest, ...focus.keys(), ...input.habitLogs.map((log) => streakWeekStart(log.date))]);
  const current = streakWeekStart(today);
  const closed = [...recorded].filter((week) => week >= created && week < current);
  const minutesOf = (weeks: DateKey[]) => weeks.map((week) => (focus.get(week) ?? 0) / MINUTE_MS);
  const rested = closed.filter((week) => withRest.has(week));
  const others = closed.filter((week) => !withRest.has(week));
  const enough = rested.length >= METRICAS.minSemanasPorTipo && others.length >= METRICAS.minSemanasPorTipo;
  return {
    total: rests.length,
    noMes: rests.filter((date) => date.slice(0, 7) === today.slice(0, 7)).length,
    semanasComDescanso: withRest.size,
    focoMedioSemanaComDescanso: enough ? Math.round(average(minutesOf(rested))) : null,
    focoMedioSemanaSem: enough ? Math.round(average(minutesOf(others))) : null,
  };
}

/**
 * Parte dos dias de hábito cumpridos na janela, só dos hábitos ativos. Cada um conta desde que existe, nos dias da
 * frequência; descanso e férias ficam fora, e hoje só entra quando já foi feito.
 */
function taxaDeHabitos(input: MetricsInput, days: readonly DateKey[], today: DateKey, resting: ReadonlySet<DateKey>): number | null {
  let expected = 0;
  let done = 0;
  for (const habit of input.habits.filter((h) => h.state === 'ativo')) {
    const dates = new Set(input.habitLogs.filter((log) => log.habitId === habit.id).map((log) => log.date));
    const [start] = [...dates, ...(habit.criadoEm ? [habit.criadoEm] : [])].sort();
    if (start === undefined) continue;
    for (const date of days) {
      if (date < start || !habit.weekdays.includes(weekdayOf(date))) continue;
      if (!dates.has(date) && (date === today || resting.has(date))) continue;
      expected += 1;
      if (dates.has(date)) done += 1;
    }
  }
  return expected === 0 ? null : done / expected;
}

/** O dia da semana com mais foco. Empate: o que teve foco mais recentemente. */
function melhorDiaDaSemana(sessions: readonly FocusSession[], dayOf: (s: FocusSession) => DateKey): Weekday | null {
  const byWeekday = new Map<Weekday, { ms: number; last: DateKey }>();
  for (const session of sessions) {
    const ms = focusedMs(session);
    if (ms === 0) continue;
    const date = dayOf(session);
    const weekday = weekdayOf(date);
    const previous = byWeekday.get(weekday) ?? { ms: 0, last: date };
    byWeekday.set(weekday, { ms: previous.ms + ms, last: date > previous.last ? date : previous.last });
  }
  const [best] = [...byWeekday].sort(([, a], [, b]) => b.ms - a.ms || (a.last < b.last ? 1 : -1));
  return best?.[0] ?? null;
}

function melhorPeriodo(sessions: readonly FocusSession[], timeZone: string): Period | null {
  const ms: Record<Period, number> = { manha: 0, tarde: 0, noite: 0 };
  const count: Record<Period, { completed: number }> = { manha: { completed: 0 }, tarde: { completed: 0 }, noite: { completed: 0 } };
  for (const session of sessions) {
    const period = periodOf(session.startedAt, timeZone);
    ms[period] += focusedMs(session);
    if (session.state === 'concluida') count[period].completed += 1;
  }
  return bestPeriod(ms, count);
}

/** Os números do Perfil. O servidor entrega pronto; o repositório em memória calcula aqui. */
export function computeMetrics(input: MetricsInput): ProfileMetrics {
  const { timeZone, dayStartMinutes = DAY_ROLLOVER_HOUR * 60 } = input;
  const { today, rest, vacation } = streakDaySets(input);
  const created = dateKeyOf(input.createdAt, timeZone, dayStartMinutes);
  const dayOf = (session: FocusSession) => dateKeyOf(session.endedAt ?? session.startedAt, timeZone, dayStartMinutes);

  const windowStart = addDays(today, 1 - METRICAS.janelaDias);
  const first = created > windowStart ? created : windowStart;
  const length = Math.max(1, diffDays(today, first) + 1);
  const days = Array.from({ length }, (_, i) => addDays(today, i - length + 1));
  const recent = input.sessions.filter((session) => {
    if (session.state === 'em_andamento') return false;
    const date = dayOf(session);
    return date >= days[0] && date <= today;
  });
  const focusMs = recent.reduce((total, session) => total + focusedMs(session), 0);

  return {
    descanso: descansoDasMetricas(input, today, created, dayOf),
    gelo: input.gelo,
    ritmo: {
      focoMedioPorDia30: Math.round(focusMs / MINUTE_MS / length),
      taxaHabitos30: taxaDeHabitos(input, days, today, new Set([...rest, ...vacation])),
      melhorPeriodo: melhorPeriodo(recent, timeZone),
      melhorDiaDaSemana: melhorDiaDaSemana(recent, dayOf),
      sessoesTerminadas: recent.filter((session) => session.state === 'concluida').length,
    },
    feitos: input.feitos,
  };
}

/** Repositório que já recebe as métricas prontas (o remoto: o servidor enxerga todo o histórico). */
export interface MetricsSource {
  getMetrics(): Promise<ProfileMetrics>;
}

export function providesMetrics(repo: Repository): repo is Repository & MetricsSource {
  return 'getMetrics' in repo && typeof repo.getMetrics === 'function';
}

/** As métricas de um repositório: as do servidor, quando ele as fornece; senão (memória), calculadas dos registros. */
export async function verMetricas(repo: Repository, clock: Clock): Promise<ProfileMetrics | null> {
  if (providesMetrics(repo)) return repo.getMetrics();
  const user = await repo.getUser();
  if (!user) return null;
  const [habits, habitLogs, sessions, restDays, goals, baus, credito, tasks, uses, purchases] = await Promise.all([
    repo.listHabits(),
    repo.listHabitLogs(),
    repo.listSessions(),
    repo.listRestDays(),
    repo.listGoals(),
    repo.listGoalChests(),
    repo.getJoiaCredit(),
    repo.listTasks(),
    providesFreezeStore(repo) ? repo.listFreezeUses() : [],
    listFreezePurchasesOf(repo),
  ]);
  return computeMetrics({
    habits,
    habitLogs,
    sessions,
    restDays,
    gelo: { usadosTotal: uses.length, guardados: resumoDoGelo(purchases.length, uses).guardados },
    feitos: {
      tarefasConcluidas: tasks.filter((task) => task.status === 'feito').length,
      metasConcluidas: goals.filter((goal) => goal.state === 'concluida').length,
      joiasGanhas: joiasGanhas({ habitLogs, sessions, restDays, goals, baus, credito }).total,
    },
    createdAt: user.createdAt,
    timeZone: user.timezone || DEFAULT_TIMEZONE,
    dayStartMinutes: user.dayStartMinutes,
    now: clock.now(),
  });
}
