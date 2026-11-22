/**
 * Todas as decisões abertas do produto, num lugar só.
 * Para mudar uma regra, mude aqui. Nenhum outro arquivo deve ter número mágico
 * que seja uma decisão do Victor. Valores marcados "proposta" vêm das specs e
 * ainda não foram confirmados.
 */

/** Fases do sapo: dias de cuidado necessários para entrar em cada fase. Proposta. */
export const PHASE_MIN_CARE_DAYS = {
  1: 0,
  2: 3,
  3: 8,
  4: 15,
} as const;

/** Sessão interrompida conta como cuidado a partir desta fração do tempo planejado. Proposta. */
export const INTERRUPTED_SESSION_MIN_RATIO = 0.5;

/** O dia lógico vira às 4h no fuso do usuário. Proposta. */
export const DAY_ROLLOVER_HOUR = 4;

/** Períodos do dia, em horas locais [início, fim). Proposta. */
export const PERIODS = {
  manha: { startHour: 5, endHour: 12 },
  tarde: { startHour: 12, endHour: 18 },
  noite: { startHour: 18, endHour: 23 },
} as const;

/** Semana estável: pelo menos este número de dias de cuidado. Proposta. */
export const STABLE_WEEK_MIN_CARE_DAYS = 5;

/**
 * Itens de progresso da lagoa: dias de cuidado necessários. Nunca somem.
 * Itens de estado (vagalumes, nuvem de chuva) dependem do momento, ver LAGOON_STATE_RULES.
 * Ordem de corte se faltar tempo: reduzir de 8 para 6 itens.
 */
export const LAGOON_PROGRESS_ITEMS_MIN_CARE_DAYS = {
  pedra: 0,
  juncos: 1,
  folhaVitoriaRegia: 3,
  aguape: 5,
  tronco: 8,
  flor: 11,
} as const;

export const LAGOON_STATE_RULES = {
  /** Vagalumes: fora do dia do usuário e com pelo menos isto de dias de cuidado na semana. */
  fireflies: { minCareDaysInWeek: 3 },
} as const;

/** Limite de elementos animados ao mesmo tempo na lagoa (web fluida). Proposta, não medida. */
export const LAGOON_MAX_ANIMATED_ELEMENTS = 12;

/** Dia do usuário. Proposta. */
export const DEFAULT_DAY_START_HOUR = 7;
export const DEFAULT_DAY_END_HOUR = 22;
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

/** Validação de dados. */
export const MAX_HABITS_PER_DAY = 5;
export const BLOCK_MIN_MINUTES = 5;
export const BLOCK_MAX_MINUTES = 120;
export const ENERGY_MIN = 1;
export const ENERGY_MAX = 5;

/** Foco (Pomodoro por horário). Proposta. */
export const FOCUS = {
  defaultMinutes: 25,
  minMinutes: 15,
  maxMinutes: 50,
  defaultBreakMinutes: 5,
  minBreakMinutes: 3,
  maxBreakMinutes: 15,
} as const;

/** Duração dos eventos transitórios do sapo, em ms. */
export const FROG_EVENT_MS = {
  pouso: 1200,
  surpreso: 3000,
  feliz: 4000,
} as const;

/** Energia do dia igual ou abaixo deste valor deixa o sapo cansado. */
export const FROG_TIRED_MAX_ENERGY = 2;

/** IA semanal e candidatas por regra. Propostas. */
export const WEEKLY_AI = {
  minDaysWithRecord: 3,
  minSessionsOrCheckIns: 5,
  minCheckInsPerPeriodToCount: 3,
  maxInterruptionsBeforeShorten: 2,
  maxChangesPerProposal: 2,
  shortenByMinutesOptions: [5, 10],
  /** Uma proposta negada não volta por este número de semanas. */
  deniedCooldownWeeks: 2,
  /** Segundos para desfazer uma mudança aceita. */
  undoSeconds: 8,
  /** Tempo máximo de espera pela IA antes de cair na regra. */
  timeoutMs: 8000,
} as const;
