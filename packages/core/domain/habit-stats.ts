import { DAY_ROLLOVER_HOUR, DEFAULT_TIMEZONE, HABITS, STREAK } from '../config/decisions';
import { addDays, diffDays, weekDates, weekdayOf } from './day';
import { streakToday, vacationDates } from './streak';
import type { Clock, DateKey, EntityId, Habit, HabitDayState, HabitLog, HabitStats, Repository, RestDay, Vacation } from './types';

export type HabitoMedido = Pick<Habit, 'weekdays'> & {
  /** Dia em que o hábito nasceu. Sem ele (registros antigos, demo), vale o primeiro dia feito. */
  criadoEm?: DateKey;
};

/**
 * Estatísticas e calendário de um hábito. `logs` são só os dele; `descansos` inclui os dias de férias.
 * O hábito começa no dia mais antigo entre a criação e o primeiro registro: antes disso o dia é `fora`.
 * Dia feito conta mesmo fora da frequência. Descanso e dia fora não quebram a sequência nem entram na taxa,
 * e hoje vazio só passa a contar quando o dia termina.
 */
export function statsDoHabito(
  habito: HabitoMedido,
  logs: readonly Pick<HabitLog, 'date'>[],
  descansos: readonly RestDay[],
  hoje: DateKey,
): HabitStats {
  const feitos = new Set(logs.map((log) => log.date).filter((date) => date <= hoje));
  const rest = new Set(descansos.map((r) => r.date));
  const weekdays = new Set(habito.weekdays);
  const primeiro = [...feitos, ...(habito.criadoEm ? [habito.criadoEm] : [])].sort()[0] ?? hoje;
  const limite = addDays(hoje, -(HABITS.statsMaxDays - 1));
  const inicio = primeiro < limite ? limite : primeiro;

  const stateOf = (date: DateKey): HabitDayState => {
    if (date > hoje) return 'futuro';
    if (feitos.has(date)) return 'feito';
    if (date < inicio || !weekdays.has(weekdayOf(date))) return 'fora';
    return rest.has(date) ? 'descanso' : 'vazio';
  };

  let run = 0;
  let recorde = 0;
  let esperados = 0;
  let cumpridos = 0;
  for (let offset = 0; offset <= diffDays(hoje, inicio); offset += 1) {
    const date = addDays(inicio, offset);
    const estado = stateOf(date);
    const scheduled = weekdays.has(weekdayOf(date));
    if (estado === 'feito') {
      run += 1;
      recorde = Math.max(recorde, run);
      if (scheduled) {
        esperados += 1;
        cumpridos += 1;
      }
    } else if (estado === 'vazio' && date !== hoje) {
      run = 0;
      esperados += 1;
    }
  }

  const weekStart = addDays(hoje, -((weekdayOf(hoje) - STREAK.weekStartsOn + 7) % 7));
  const calendario = Array.from({ length: HABITS.statsWeeks }, (_, week) =>
    weekDates(addDays(weekStart, (week - HABITS.statsWeeks + 1) * 7)).map((date) => ({ date, estado: stateOf(date) })),
  );
  return { sequencia: run, recorde, taxa: esperados === 0 ? null : cumpridos / esperados, total: feitos.size, calendario };
}

export interface HabitStatsInput {
  habito: HabitoMedido;
  logs: readonly Pick<HabitLog, 'date'>[];
  restDays: readonly RestDay[];
  /** Modo férias (spec 15): os dias de férias contam como descanso. */
  vacation?: Vacation;
  timeZone: string;
  /** Hora em que o dia vira para a pessoa, em minutos desde 00:00. */
  dayStartMinutes?: number;
  now: number;
}

/** `statsDoHabito` a partir dos registros crus, com o mesmo "hoje" da sequência geral. */
export function computeHabitStats(input: HabitStatsInput): HabitStats {
  const { habito, logs, restDays, vacation, timeZone, now, dayStartMinutes = DAY_ROLLOVER_HOUR * 60 } = input;
  const hoje = streakToday(now, timeZone, dayStartMinutes, [...logs, ...restDays].map((r) => r.date));
  const descansos = [...restDays, ...vacationDates(vacation, hoje).map((date) => ({ date }))];
  return statsDoHabito(habito, logs, descansos, hoje);
}

/** Repositório que já recebe as estatísticas prontas (o remoto: o servidor enxerga todo o histórico). */
export interface HabitStatsSource {
  getHabitStats(id: EntityId): Promise<HabitStats>;
}

export function providesHabitStats(repo: Repository): repo is Repository & HabitStatsSource {
  return 'getHabitStats' in repo && typeof repo.getHabitStats === 'function';
}

/** As estatísticas de um hábito: as do servidor, quando ele as fornece; senão (demo, memória), calculadas. `null` se não existe. */
export async function verEstatisticasDoHabito(repo: Repository, id: EntityId, clock: Clock): Promise<HabitStats | null> {
  const habito = (await repo.listHabits()).find((h) => h.id === id);
  if (!habito) return null;
  if (providesHabitStats(repo)) return repo.getHabitStats(id);
  const [user, logs, restDays] = await Promise.all([repo.getUser(), repo.listHabitLogs(), repo.listRestDays()]);
  return computeHabitStats({
    habito,
    logs: logs.filter((log) => log.habitId === id),
    restDays,
    timeZone: user?.timezone ?? DEFAULT_TIMEZONE,
    dayStartMinutes: user?.dayStartMinutes,
    now: clock.now(),
  });
}
