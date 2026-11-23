/**
 * Contratos do domínio. Só o responsável pelo contrato altera este arquivo.
 * Os módulos de domínio, dados, mascote e demo apenas leem.
 *
 * Datas e horas:
 * - `DateKey` é o dia LÓGICO (vira às DAY_ROLLOVER_HOUR no fuso do usuário), 'AAAA-MM-DD'.
 * - Instantes são milissegundos desde a época (número), nunca Date.
 * - Nenhuma função de domínio chama Date.now(): recebem `Clock` ou `now`.
 */

export type DateKey = string;
export type EntityId = string;

/** Dia da semana: 0 = segunda ... 6 = domingo (semana de segunda a domingo). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type Period = 'manha' | 'tarde' | 'noite';
export type Phase = 1 | 2 | 3 | 4;

export interface Clock {
  /** Instante atual em ms desde a época. */
  now(): number;
}

// ---------- Entidades ----------

export interface User {
  id: EntityId;
  /** Nome do sapo (nunca enviado à IA). */
  frogName: string;
  /** Fuso IANA, padrão America/Sao_Paulo. */
  timezone: string;
  /** Início e fim do dia do usuário, em minutos desde 00:00. */
  dayStartMinutes: number;
  dayEndMinutes: number;
  theme: 'claro' | 'escuro' | 'sistema';
  reduceMotion: boolean;
  createdAt: number;
}

export interface RoutineBlock {
  id: EntityId;
  weekday: Weekday;
  /** Início, em minutos desde 00:00 do dia. */
  startMinutes: number;
  /** 5 a 120. */
  durationMinutes: number;
  kind: 'foco' | 'descanso';
  title?: string;
}

export interface Habit {
  id: EntityId;
  title: string;
  weekdays: Weekday[];
  active: boolean;
}

export interface HabitLog {
  habitId: EntityId;
  date: DateKey;
  doneAt: number;
}

export type FocusSessionState = 'em_andamento' | 'concluida' | 'interrompida';

export interface FocusSession {
  id: EntityId;
  blockId?: EntityId;
  startedAt: number;
  endedAt?: number;
  plannedMinutes: number;
  state: FocusSessionState;
  /** Tempo total pausado, em ms. */
  pausedMs: number;
  /** Se está pausada agora, o instante em que a pausa começou. */
  pausedSince?: number;
}

export interface RestDay {
  date: DateKey;
}

export type ProposalState = 'pendente' | 'aceita' | 'editada' | 'negada' | 'expirada';
export type ProposalOrigin = 'ia' | 'regra';
export type ProposalChangeKind = 'mover_foco' | 'encurtar_foco';

export interface BlockSlot {
  weekday: Weekday;
  startMinutes: number;
  durationMinutes: number;
}

export interface ProposalChange {
  kind: ProposalChangeKind;
  blockId: EntityId;
  from: BlockSlot;
  to: BlockSlot;
}

export interface WeeklyProposal {
  id: EntityId;
  /** Segunda-feira da semana (DateKey). */
  weekStart: DateKey;
  state: ProposalState;
  /** "O que o app notou", em uma frase. */
  patternText: string;
  /** "Por que a mudança", uma frase curta. */
  reasonText?: string;
  changes: ProposalChange[];
  origin: ProposalOrigin;
  createdAt: number;
  decidedAt?: number;
}

export type GoalState = 'ativa' | 'concluida';

/** Passo de uma meta. `doneAt` existe quando o marco foi riscado. */
export interface GoalMilestone {
  id: EntityId;
  title: string;
  doneAt?: number;
}

/**
 * Meta de longo prazo (meses ou anos), acima dos hábitos e da semana.
 * Os marcos são os passos que a tornam concreta; `targetDate` é opcional.
 */
export interface Goal {
  id: EntityId;
  title: string;
  /** Por que essa meta importa, em uma frase. */
  why?: string;
  targetDate?: DateKey;
  state: GoalState;
  milestones: GoalMilestone[];
  createdAt: number;
  completedAt?: number;
}

/** Derivado e guardado em cache. Nunca é a fonte da verdade. */
export interface MascotState {
  phase: Phase;
  careDays: number;
  updatedAt: number;
}

// ---------- Resumo da semana (entrada da IA e das telas) ----------
// Não contém títulos, nomes nem texto livre.

export interface PeriodSessionStats {
  completed: number;
  interrupted: number;
  /** completed / (completed + interrupted), ou null sem sessões. */
  completionRate: number | null;
}

export interface WeekSummary {
  /** Segunda e domingo da semana, DateKey. */
  weekStart: DateKey;
  weekEnd: DateKey;
  focusMinutesByPeriod: Record<Period, number>;
  sessionsByPeriod: Record<Period, PeriodSessionStats>;
  totalSessions: number;
  restDays: number;
  careDays: number;
  /** Dias com qualquer registro (sessão, descanso ou hábito). */
  daysWithRecord: number;
  /** careDays >= STABLE_WEEK_MIN_CARE_DAYS. */
  stable: boolean;
}

// ---------- Repositório ----------

export interface DateRange {
  from: DateKey;
  to: DateKey;
}

/**
 * Armazenamento atrás de uma interface. Implementação inicial: memória e um
 * adaptador simples de chave e valor (sem expo-sqlite na web).
 * Sessões de foco são imutáveis depois de encerradas: só `clearAll` zera o progresso.
 */
export interface Repository {
  getUser(): Promise<User | null>;
  saveUser(user: User): Promise<void>;

  listBlocks(): Promise<RoutineBlock[]>;
  saveBlock(block: RoutineBlock): Promise<void>;
  deleteBlock(id: EntityId): Promise<void>;

  listHabits(): Promise<Habit[]>;
  saveHabit(habit: Habit): Promise<void>;
  deleteHabit(id: EntityId): Promise<void>;
  listHabitLogs(range?: DateRange): Promise<HabitLog[]>;
  saveHabitLog(log: HabitLog): Promise<void>;
  deleteHabitLog(habitId: EntityId, date: DateKey): Promise<void>;

  listSessions(): Promise<FocusSession[]>;
  saveSession(session: FocusSession): Promise<void>;

  listRestDays(): Promise<RestDay[]>;
  saveRestDay(restDay: RestDay): Promise<void>;
  deleteRestDay(date: DateKey): Promise<void>;

  listProposals(): Promise<WeeklyProposal[]>;
  saveProposal(proposal: WeeklyProposal): Promise<void>;

  listGoals(): Promise<Goal[]>;
  saveGoal(goal: Goal): Promise<void>;
  deleteGoal(id: EntityId): Promise<void>;

  getMascotState(): Promise<MascotState | null>;
  saveMascotState(state: MascotState): Promise<void>;

  /** "Apagar todos os meus dados": único jeito de zerar o progresso. */
  clearAll(): Promise<void>;
}

// ---------- Sapo ----------

export type FrogMood =
  | 'parado'
  | 'feliz'
  | 'cansado'
  | 'pensando'
  | 'surpreso'
  | 'focado'
  | 'dormindo'
  | 'pouso';

/** Eventos transitórios, do mais prioritário ao menos. */
export type FrogEvent = 'pouso' | 'surpreso' | 'feliz';

/**
 * Entradas da máquina de estados do sapo (função pura em src/mascot/machine.ts).
 * Prioridade: pouso > surpreso > feliz > pensando > focado > cansado > dormindo > parado.
 */
export interface FrogInputs {
  phase: Phase;
  /** Focos interrompidos hoje (dia lógico). */
  interruptedFocusToday: number;
  focusRunning: boolean;
  aiAnalyzing: boolean;
  /** Evento transitório ativo agora (já dentro da janela de duração), se houver. */
  activeEvent: FrogEvent | null;
  /** O horário atual está dentro do dia do usuário. */
  withinUserDay: boolean;
}
