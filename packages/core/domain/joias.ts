import { DEFAULT_TIMEZONE, JOIAS, MAX_HABITS_PER_DAY } from '../config/decisions';
import { effectiveMs } from './care-days';
import { dateKeyOf } from './day';
import type { DateKey, FocusSession, GoalChest, Goal, HabitLog, Purchase, Repository, RestDay } from './types';

/** Repositório que sabe das compras de gelo (spec 29): elas também gastam joias. */
export interface FreezePurchaseList {
  listFreezePurchases(): Promise<Purchase[]>;
}

export function providesFreezePurchases(repo: Repository): repo is Repository & FreezePurchaseList {
  return 'listFreezePurchases' in repo && typeof repo.listFreezePurchases === 'function';
}

/** As compras de gelo de um repositório; vazio quando ele não as guarda. */
export async function listFreezePurchasesOf(repo: Repository): Promise<Purchase[]> {
  return providesFreezePurchases(repo) ? repo.listFreezePurchases() : [];
}

/**
 * Repositório que só guarda uma janela do histórico (o remoto): o servidor diz quantas joias os registros
 * de fora dela renderam, para o saldo bater com o dele.
 */
export interface JoiasForaDoCache {
  getJoiasForaDaJanela(): Promise<number>;
}

export function providesJoiasForaDoCache(repo: Repository): repo is Repository & JoiasForaDoCache {
  return 'getJoiasForaDaJanela' in repo && typeof repo.getJoiasForaDaJanela === 'function';
}

export async function joiasForaDaJanelaDe(repo: Repository): Promise<number> {
  return providesJoiasForaDoCache(repo) ? repo.getJoiasForaDaJanela() : 0;
}

/** O que gera joias. Tudo vem dos registros que o app já guarda, mais o crédito histórico. */
export interface FontesDeJoias {
  habitLogs: readonly HabitLog[];
  sessions: readonly FocusSession[];
  restDays: readonly RestDay[];
  goals: readonly Goal[];
  /** Baús de meta abertos: só eles pagam o prêmio da meta (spec 16). */
  baus: readonly GoalChest[];
  /** Joias dadas na troca de regra, para ninguém perder saldo. */
  credito: number;
  /** Joias de registros que não vieram nas listas acima (histórico fora da janela do sync). */
  foraDaJanela?: number;
}

export interface JoiasGanhas {
  habitos: number;
  focos: number;
  descansos: number;
  marcos: number;
  metas: number;
  anteriores: number;
  total: number;
}

/** Tempo focado de uma sessão terminada, em ms: sem as pausas e até o planejado. Em andamento vale zero. */
export function focusedMs(session: FocusSession): number {
  if (session.state === 'em_andamento') return 0;
  return Math.max(0, Math.min(effectiveMs(session), session.plannedMinutes * 60_000));
}

/** Joias de uma sessão: uma a cada `focusMinutesPerJoia` minutos focados (sem pausas, até o planejado). */
export function joiasDoFoco(session: FocusSession): number {
  return Math.floor(focusedMs(session) / (JOIAS.focusMinutesPerJoia * 60_000));
}

/** Quantas vezes cada dia aparece. */
export function contarPorDia(registros: readonly { date: DateKey }[]): number[] {
  const dias = new Map<DateKey, number>();
  for (const { date } of registros) dias.set(date, (dias.get(date) ?? 0) + 1);
  return [...dias.values()];
}

/** Joias dos hábitos, a partir de quantos foram feitos em cada dia: cada dia paga no máximo `MAX_HABITS_PER_DAY`. */
export function joiasDosHabitos(feitosPorDia: readonly number[]): number {
  return feitosPorDia.reduce((n, feitos) => n + Math.min(feitos, MAX_HABITS_PER_DAY), 0) * JOIAS.por.habitDone;
}

/** Os instantes dos marcos riscados que pagam: no máximo `maxMarcosPorDia` por dia. */
export function marcosPagos(goals: readonly Goal[]): number[] {
  const porDia = new Map<DateKey, number>();
  return goals
    .flatMap((g) => g.milestones.flatMap((m) => (m.doneAt === undefined ? [] : [m.doneAt])))
    .filter((doneAt) => {
      const dia = dateKeyOf(doneAt, DEFAULT_TIMEZONE);
      const pagos = porDia.get(dia) ?? 0;
      porDia.set(dia, pagos + 1);
      return pagos < JOIAS.maxMarcosPorDia;
    });
}

/** Joias ganhas desde sempre. Calculado, nunca gravado: desmarcar um hábito devolve a joia. */
export function joiasGanhas(fontes: FontesDeJoias): JoiasGanhas {
  const por = JOIAS.por;
  const habitos = joiasDosHabitos(contarPorDia(fontes.habitLogs));
  const focos = fontes.sessions.reduce((n, s) => n + joiasDoFoco(s), 0);
  const descansos = fontes.restDays.length * por.restDay;
  const marcos = marcosPagos(fontes.goals).length * por.milestoneDone;
  const metas = fontes.baus.reduce((n, b) => n + b.joias, 0);
  const anteriores = fontes.credito + (fontes.foraDaJanela ?? 0);
  return { habitos, focos, descansos, marcos, metas, anteriores, total: habitos + focos + descansos + marcos + metas + anteriores };
}

export const joiasGastas = (compras: readonly Purchase[]): number => compras.reduce((n, c) => n + c.cost, 0);

/** Nunca negativo (se a pessoa desmarcar hábitos depois de comprar, fica em zero). */
export const saldoDeJoias = (ganhas: number, gastas: number): number => Math.max(0, ganhas - gastas);

/** "Falta 1 joia." ou "Faltam N joias." */
export const textoDeFalta = (falta: number): string => (falta === 1 ? 'Falta 1 joia.' : `Faltam ${falta} joias.`);
