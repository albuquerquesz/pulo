import { JOIAS } from '../config/decisions';
import { effectiveMs } from './care-days';
import type { FocusSession, GoalChest, Goal, HabitLog, Purchase, RestDay } from './types';

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

/** Joias ganhas desde sempre. Calculado, nunca gravado: desmarcar um hábito devolve a joia. */
export function joiasGanhas(fontes: FontesDeJoias): JoiasGanhas {
  const por = JOIAS.por;
  const habitos = fontes.habitLogs.length * por.habitDone;
  const focos = fontes.sessions.reduce((n, s) => n + joiasDoFoco(s), 0);
  const descansos = fontes.restDays.length * por.restDay;
  const marcos = fontes.goals.reduce((n, g) => n + g.milestones.filter((m) => m.doneAt !== undefined).length, 0) * por.milestoneDone;
  const metas = fontes.baus.reduce((n, b) => n + b.joias, 0);
  const anteriores = fontes.credito;
  return { habitos, focos, descansos, marcos, metas, anteriores, total: habitos + focos + descansos + marcos + metas + anteriores };
}

export const joiasGastas = (compras: readonly Purchase[]): number => compras.reduce((n, c) => n + c.cost, 0);

/** Nunca negativo (se a pessoa desmarcar hábitos depois de comprar, fica em zero). */
export const saldoDeJoias = (ganhas: number, gastas: number): number => Math.max(0, ganhas - gastas);

/** "Falta 1 joia." ou "Faltam N joias." */
export const textoDeFalta = (falta: number): string => (falta === 1 ? 'Falta 1 joia.' : `Faltam ${falta} joias.`);
