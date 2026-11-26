import { DEFAULT_TIMEZONE, DAY_ROLLOVER_HOUR, DESCANSO } from '../config/decisions';
import { addDays } from './day';
import { type Result, fail, ok } from './result';
import { streakToday, streakWeekStart } from './streak';
import type { Clock, DateKey, Repository, RestDay, RestStatus } from './types';

export type RestErrorCode = 'descanso_so_hoje' | 'limite_de_descanso';

export interface DescansoHojeInput {
  /** O dia que se quer marcar ou desmarcar. */
  date: DateKey;
  /** Dias que já têm hábito feito ou descanso. */
  dated: readonly DateKey[];
  timeZone: string;
  /** Hora em que o dia vira para a pessoa, em minutos desde 00:00. Sem perfil, `DAY_ROLLOVER_HOUR`. */
  dayStartMinutes?: number;
  now: number;
}

/**
 * O "hoje" do descanso, o mesmo da sequência. O próprio dia pedido entra na conta: entre a virada do app e o começo do
 * dia da pessoa, marcar o dia novo já o começa.
 */
export function hojeDoDescanso({ date, dated, timeZone, dayStartMinutes = DAY_ROLLOVER_HOUR * 60, now }: DescansoHojeInput): DateKey {
  return streakToday(now, timeZone, dayStartMinutes, [...dated, date]);
}

/** Descansos que ainda cabem na semana do app em que `hoje` cai. */
export function situacaoDoDescanso(hoje: DateKey, restDays: readonly RestDay[]): RestStatus {
  const de = streakWeekStart(hoje);
  const ate = addDays(de, 6);
  const marcados = new Set(restDays.map((r) => r.date).filter((date) => date >= de && date <= ate));
  const maxPorSemana = DESCANSO.maxPorSemana;
  return { restantesNaSemana: Math.max(0, maxPorSemana - marcados.size), maxPorSemana };
}

/** Só o dia de hoje pode ser marcado ou desmarcado. */
export function validarDiaDoDescanso(date: DateKey, hoje: DateKey): Result<DateKey, 'descanso_so_hoje'> {
  return date === hoje ? ok(date) : fail('descanso_so_hoje', 'O descanso vale só para o dia de hoje.');
}

/** Se dá para marcar descanso em `date`. Marcar de novo um dia já marcado é aceito. */
export function validarDescanso(date: DateKey, hoje: DateKey, restDays: readonly RestDay[]): Result<DateKey, RestErrorCode> {
  const dia = validarDiaDoDescanso(date, hoje);
  if (!dia.ok || restDays.some((r) => r.date === date)) return dia;
  if (situacaoDoDescanso(hoje, restDays).restantesNaSemana > 0) return dia;
  return fail('limite_de_descanso', `Dá para marcar até ${DESCANSO.maxPorSemana} descansos por semana.`);
}

async function lerParaDescanso(repo: Repository, clock: Clock, date?: DateKey) {
  const [user, habitLogs, restDays] = await Promise.all([repo.getUser(), repo.listHabitLogs(), repo.listRestDays()]);
  const dated = [...habitLogs, ...restDays].map((r) => r.date);
  const timeZone = user?.timezone ?? DEFAULT_TIMEZONE;
  const now = clock.now();
  const dayStartMinutes = user?.dayStartMinutes;
  const hoje =
    date === undefined
      ? streakToday(now, timeZone, dayStartMinutes ?? DAY_ROLLOVER_HOUR * 60, dated)
      : hojeDoDescanso({ date, dated, timeZone, dayStartMinutes, now });
  return { hoje, restDays };
}

/** Quantos descansos ainda dá para marcar nesta semana. */
export async function verDescanso(repo: Repository, clock: Clock): Promise<RestStatus> {
  const { hoje, restDays } = await lerParaDescanso(repo, clock);
  return situacaoDoDescanso(hoje, restDays);
}

/** Marca o descanso de hoje, com a regra do dia e do limite. */
export async function marcarDescanso(repo: Repository, clock: Clock, date: DateKey): Promise<Result<DateKey, RestErrorCode>> {
  const { hoje, restDays } = await lerParaDescanso(repo, clock, date);
  const valido = validarDescanso(date, hoje, restDays);
  if (valido.ok) await repo.saveRestDay({ date });
  return valido;
}

/** Desmarca o descanso de hoje. */
export async function desmarcarDescanso(repo: Repository, clock: Clock, date: DateKey): Promise<Result<DateKey, 'descanso_so_hoje'>> {
  const { hoje } = await lerParaDescanso(repo, clock, date);
  const valido = validarDiaDoDescanso(date, hoje);
  if (valido.ok) await repo.deleteRestDay(date);
  return valido;
}
