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
  /** Meta que o hábito empurra (spec 16); no máximo uma. */
  goalId?: EntityId;
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

export type AmbientSound = 'silencio' | 'lagoa' | 'chuva';

/** Intervalo de dias de férias, extremos incluídos. */
export interface VacationPeriod {
  de: DateKey;
  ate: DateKey;
}

export interface Vacation {
  ligado: boolean;
  /** Primeiro dia das férias atuais; `null` com o modo desligado. */
  desde: DateKey | null;
  /** Férias já encerradas: continuam valendo como descanso na sequência. */
  periodos: VacationPeriod[];
}

/** Preferências da conta (spec 15). */
export interface Preferences {
  focusMinutes: number;
  breakMinutes: number;
  /** `null` = sem meta diária. */
  dailyFocusGoalMinutes: number | null;
  /** `minutos` desde 00:00, no fuso da pessoa. Só a preferência: a entrega do lembrete não existe ainda. */
  eveningReminder: { ligado: boolean; minutos: number };
  vacation: Vacation;
  sounds: boolean;
  aiEnabled: boolean;
  ambientSound: AmbientSound;
}

/** Números de todo o tempo, mostrados no Perfil. */
export interface ProfileStats {
  habitosFeitos: number;
  minutosDeFoco: number;
  /** Instante (ms) em que a conta foi criada. */
  desde: number;
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

/** Cor de destaque escolhida pela pessoa: um nome do design system (`ACCENT_COLORS`), nunca um hex. */
export type AccentColor = 'sapo' | 'agua' | 'foco' | 'descanso' | 'sol' | 'atencao';

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
  /** Emoji curto (spec 16). Ausente: a tela usa `GOALS.defaultIcon`. */
  icon?: string;
  /** Ausente: a tela usa `GOALS.defaultColor`. */
  color?: AccentColor;
}

/** Resgate do baú de uma meta concluída (spec 16): um por meta, e só então as joias contam no saldo. */
export interface GoalChest {
  goalId: EntityId;
  abertoEm: number;
  joias: number;
}

/**
 * Compra com joias (spec 18). Uma por item; o preço nunca muda nem some (só `clearAll`).
 * O saldo de joias é calculado a partir dos registros, nunca gravado.
 */
export interface Purchase {
  /** Id do item no catálogo (`HOUSE`, `ROOM_DECOR` ou, no legado, `ISLAND`). */
  item: string;
  /** Joias pagas, igual ao preço do catálogo na hora da compra. */
  cost: number;
  createdAt: number;
}

/** Compra da ilha antiga (spec 12, legado): área ou enfeite. */
export type IslandPurchase = Purchase;

/** Giro de um item no chão do quarto, em graus (`ROOM_GRID.rotations`). */
export type RoomRotation = 0 | 90 | 180 | 270;

/** Lugar de um item no chão do quarto. Mover é grátis. */
export interface RoomSpot {
  x: number;
  y: number;
  rotation: RoomRotation;
}

/** Decoração comprada, onde está no quarto. */
export interface RoomDecor extends Purchase, RoomSpot {}

/** Derivado e guardado em cache. Nunca é a fonte da verdade. */
export interface MascotState {
  phase: Phase;
  careDays: number;
  updatedAt: number;
}

// ---------- Tarefas (spec 20) ----------

export type TaskStatus = 'ideias' | 'afazer' | 'fazendo' | 'feito';
export type TaskPriority = 'normal' | 'alta';

/** Cartão do quadro. `completedAt` existe quando, e só quando, o status é `feito`. */
export interface Task {
  id: EntityId;
  /** Sequência por pessoa, que gera o código `PULO-n`. Quem atribui é o repositório na primeira gravação; nunca muda nem é reusado. */
  number?: number;
  title: string;
  description?: string;
  status: TaskStatus;
  /** Ordem dentro da coluna (menor em cima). Fracionário, para reordenar sem reescrever a coluna. */
  position: number;
  priority: TaskPriority;
  /** Prazo. "Esta semana" é o domingo da semana. */
  dueDate?: DateKey;
  tags: string[];
  goalId?: EntityId;
  pomodorosEstimated: number;
  /** Fica o da primeira gravação. */
  createdAt: number;
  completedAt?: number;
}

export interface TaskSubtask {
  id: EntityId;
  taskId: EntityId;
  title: string;
  done: boolean;
  position: number;
}

export interface TaskComment {
  id: EntityId;
  taskId: EntityId;
  body: string;
  createdAt: number;
}

export type TaskEventKind = 'criada' | 'status' | 'prioridade' | 'prazo';

/** Registro de uma mudança, gravado pelo repositório. `de` e `para` são o valor antigo e o novo (ausente = sem valor). */
export interface TaskEvent {
  id: EntityId;
  taskId: EntityId;
  kind: TaskEventKind;
  de?: string;
  para?: string;
  createdAt: number;
}

/** O histórico de uma tarefa, lido sob demanda (mais antigo primeiro). */
export interface TaskActivity {
  events: TaskEvent[];
  comments: TaskComment[];
}

// ---------- Sequência ----------

/** `hoje` é o dia de hoje ainda vazio; com algo feito ou descanso marcado, ele aparece como tal. */
export type StreakDayState = 'feito' | 'descanso' | 'vazio' | 'hoje' | 'futuro';

export interface StreakDay {
  date: DateKey;
  estado: StreakDayState;
}

/** Sequência com foguinho. Calculada a partir dos registros, nunca gravada. */
export interface Streak {
  /** Dias feitos seguidos até hoje (descanso não quebra nem soma). */
  atual: number;
  /** Maior sequência de todo o histórico. */
  recorde: number;
  /** Os 7 dias da semana corrente, na ordem (veja `STREAK.weekStartsOn`). */
  semana: StreakDay[];
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
  /** Apaga a meta e o baú dela; hábitos e tarefas ficam, sem a meta. */
  deleteGoal(id: EntityId): Promise<void>;
  /** Baús já abertos. */
  listGoalChests(): Promise<GoalChest[]>;
  /** Abre o baú de uma meta concluída. No remoto, quem decide as joias e a hora é o servidor. */
  saveGoalChest(chest: GoalChest): Promise<void>;

  listIslandPurchases(): Promise<IslandPurchase[]>;
  saveIslandPurchase(purchase: IslandPurchase): Promise<void>;

  /** Partes da casa compradas. */
  listHousePurchases(): Promise<Purchase[]>;
  saveHousePurchase(purchase: Purchase): Promise<void>;
  /** Decorações compradas, com a posição. */
  listRoomDecor(): Promise<RoomDecor[]>;
  saveRoomDecor(decor: RoomDecor): Promise<void>;
  /** Muda a posição de uma decoração já comprada. Item não comprado não faz nada no repositório local. */
  moveRoomDecor(item: string, spot: RoomSpot): Promise<void>;
  /** Joias de ganho histórico dadas na troca de regra (spec 18); 0 para quem começou depois. Só o servidor concede. */
  getJoiaCredit(): Promise<number>;

  listTasks(): Promise<Task[]>;
  /** Cria ou atualiza. O número e o `createdAt` da primeira gravação ficam; mudar status, prioridade ou prazo gera um evento. */
  saveTask(task: Task): Promise<void>;
  /** Apaga a tarefa com subtarefas, comentários e eventos. */
  deleteTask(id: EntityId): Promise<void>;
  listSubtasks(): Promise<TaskSubtask[]>;
  /** A tarefa precisa existir. */
  saveSubtask(subtask: TaskSubtask): Promise<void>;
  deleteSubtask(taskId: EntityId, id: EntityId): Promise<void>;
  /** A tarefa precisa existir. Repetir o mesmo comentário não duplica. */
  addTaskComment(comment: TaskComment): Promise<void>;
  /** Eventos e comentários de uma tarefa. Falha se a tarefa não existe. */
  listTaskActivity(taskId: EntityId): Promise<TaskActivity>;

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
