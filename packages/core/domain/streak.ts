import { DAY_ROLLOVER_HOUR, DEFAULT_TIMEZONE, STREAK } from '../config/decisions';
import { sessionCountsAsCare } from './care-days';
import { addDays, dateKeyOf, diffDays, weekDates, weekdayOf } from './day';
import { listFreezeDatesOf } from './gelo-store';
import type { Clock, DateKey, FocusSession, HabitLog, Repository, RestDay, Streak, StreakDayState, Vacation } from './types';

export interface StreakInput {
  /** Só a data importa: um registro por dia basta. */
  habitLogs: readonly Pick<HabitLog, 'date'>[];
  sessions: readonly FocusSession[];
  restDays: readonly RestDay[];
  /** Modo férias (spec 15): os dias de férias contam como descanso. */
  vacation?: Vacation;
  /** Dias protegidos por gelo (spec 29): mantêm a sequência sem somar. */
  freezes?: readonly DateKey[];
  timeZone: string;
  /** Hora em que o dia vira para a pessoa, em minutos desde 00:00. Sem perfil, `DAY_ROLLOVER_HOUR`. */
  dayStartMinutes?: number;
  now: number;
}

/**
 * Dia de hoje da sequência: vira no começo do dia da pessoa. Os hábitos e descansos são gravados com o dia lógico do app
 * (virada às `DAY_ROLLOVER_HOUR`); se já existe um deles no dia seguinte (marcado entre as duas viradas), esse dia já começou,
 * para o que a pessoa acabou de fazer aparecer e o número não mudar de novo na virada. Registros além disso não contam.
 */
export function streakToday(now: number, timeZone: string, rolloverMinutes: number, dated: readonly DateKey[]): DateKey {
  const own = dateKeyOf(now, timeZone, rolloverMinutes);
  const app = dateKeyOf(now, timeZone);
  return dated.reduce((today, date) => (date > today && date <= app ? date : today), own);
}

/** Os dias de férias até hoje: períodos encerrados e o atual. */
export function vacationDates(vacation: Vacation | undefined, today: DateKey): DateKey[] {
  if (!vacation) return [];
  const current = vacation.ligado && vacation.desde ? [{ de: vacation.desde, ate: today }] : [];
  const dates: DateKey[] = [];
  for (const { de, ate } of [...vacation.periodos, ...current]) {
    for (let date = de; date <= ate && date <= today; date = addDays(date, 1)) dates.push(date);
  }
  return dates;
}

/** O primeiro dia da semana do app (`STREAK.weekStartsOn`) em que `date` cai. */
export function streakWeekStart(date: DateKey): DateKey {
  return addDays(date, -((weekdayOf(date) - STREAK.weekStartsOn + 7) % 7));
}

/** Os dias que a sequência olha: hoje, os com cuidado, os descansos marcados e os de férias. */
export function streakDaySets(input: StreakInput) {
  const { timeZone, now, dayStartMinutes = DAY_ROLLOVER_HOUR * 60 } = input;
  const habitDates = input.habitLogs.map((log) => log.date);
  const rest = new Set(input.restDays.map((r) => r.date));
  const today = streakToday(now, timeZone, dayStartMinutes, [...habitDates, ...rest]);
  const vacation = new Set(vacationDates(input.vacation, today));

  const done = new Set(habitDates);
  for (const session of input.sessions) {
    if (sessionCountsAsCare(session)) done.add(dateKeyOf(session.endedAt ?? session.startedAt, timeZone, dayStartMinutes));
  }
  return { today, done, rest, vacation };
}

/**
 * Sequência atual, recorde e a semana corrente. Um dia conta quando tem um hábito feito ou uma sessão de foco que conta
 * como cuidado. Descanso e gelo mantêm a chama sem somar. Hoje vazio só quebra quando o dia termina.
 */
export function computeStreak(input: StreakInput): Streak {
  const { today, done, rest, vacation } = streakDaySets(input);
  const resting = new Set([...rest, ...vacation]);
  const frozen = new Set(input.freezes);

  // Trechos sem dia vazio no meio (feitos, descansos e gelos); o tamanho de cada um é o número de dias feitos.
  let run = 0;
  let recorde = 0;
  let last: DateKey | undefined;
  for (const date of [...new Set([...done, ...resting, ...frozen])].filter((d) => d <= today).sort()) {
    if (last === undefined || diffDays(date, last) > 1) run = 0;
    if (done.has(date)) run += 1;
    recorde = Math.max(recorde, run);
    last = date;
  }
  // O último trecho segue vivo se chega até hoje ou ontem.
  const atual = last !== undefined && diffDays(today, last) <= 1 ? run : 0;

  const stateOf = (date: DateKey): StreakDayState => {
    if (date > today) return 'futuro';
    if (done.has(date)) return 'feito';
    if (resting.has(date)) return 'descanso';
    if (frozen.has(date)) return 'gelo';
    return date === today ? 'hoje' : 'vazio';
  };
  return { atual, recorde, semana: weekDates(streakWeekStart(today)).map((date) => ({ date, estado: stateOf(date) })) };
}

/** Repositório que já recebe a sequência pronta (o remoto: o servidor enxerga todo o histórico). */
export interface StreakSource {
  getStreak(): Promise<Streak>;
}

export function providesStreak(repo: Repository): repo is Repository & StreakSource {
  return 'getStreak' in repo && typeof repo.getStreak === 'function';
}

/** A sequência de um repositório: a do servidor, quando ele a fornece; senão (demo, memória), calculada dos registros. */
export async function verSequencia(repo: Repository, clock: Clock): Promise<Streak> {
  if (providesStreak(repo)) return repo.getStreak();
  const [user, habitLogs, sessions, restDays, freezes] = await Promise.all([
    repo.getUser(),
    repo.listHabitLogs(),
    repo.listSessions(),
    repo.listRestDays(),
    listFreezeDatesOf(repo),
  ]);
  return computeStreak({
    habitLogs,
    sessions,
    restDays,
    freezes,
    timeZone: user?.timezone ?? DEFAULT_TIMEZONE,
    dayStartMinutes: user?.dayStartMinutes,
    now: clock.now(),
  });
}
