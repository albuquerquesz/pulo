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

/**
 * Sequência com foguinho (spec 13). A semana mostrada vai de domingo a sábado, como as letras D S T Q Q S S
 * (0 = segunda ... 6 = domingo). A virada do dia é o começo do dia da pessoa; sem perfil, `DAY_ROLLOVER_HOUR`. Proposta.
 */
export const STREAK = {
  weekStartsOn: 6,
} as const;

/**
 * Gelo da sequência (spec 29): comprado com joias e gasto sozinho num dia que termina vazio.
 * `presenteInicial` é o gelo que toda pessoa já tem sem comprar. Proposta.
 */
export const GELO = {
  preco: 50,
  maxGuardados: 2,
  presenteInicial: 1,
} as const;

/** Dia de descanso (spec 29): só o de hoje, até este número por semana do app (`STREAK.weekStartsOn`). Proposta. */
export const DESCANSO = {
  maxPorSemana: 2,
} as const;

/**
 * Métricas do Perfil (spec 29): as médias olham os últimos `janelaDias` dias lógicos, e a comparação entre semanas com e
 * sem descanso só aparece com `minSemanasPorTipo` semanas de cada tipo. Proposta.
 */
export const METRICAS = {
  janelaDias: 30,
  minSemanasPorTipo: 2,
} as const;

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

/** Cores de destaque que a pessoa pode escolher (nomes do design system, spec 16). */
export const ACCENT_COLORS = ['sapo', 'agua', 'foco', 'descanso', 'sol', 'atencao'] as const;

/**
 * Hábitos (spec 17). O ícone é um emoji curto (vale também para o bloco da rotina).
 * `statsWeeks` é o tamanho do calendário; `statsMaxDays` limita quanto do histórico entra na conta. Proposta.
 */
export const HABITS = {
  iconMaxChars: 16,
  defaultIcon: '🌱',
  defaultColor: 'sapo',
  statsWeeks: 16,
  statsMaxDays: 3660,
} as const;

/** Metas de longo prazo. Poucas ativas de cada vez, para cada uma receber atenção de verdade. Proposta. */
export const GOALS = {
  maxActive: 3,
  maxMilestones: 12,
  /** O ícone é um emoji curto (em unidades UTF-16: um emoji composto passa de dez). */
  iconMaxChars: 16,
  defaultIcon: '🎯',
  defaultColor: 'agua',
  /** Ritmo: quanto o feito pode ficar abaixo do esperado (0 a 1) e ainda estar no ritmo. */
  paceTolerance: 0.1,
} as const;

/**
 * Tarefas em quadro (spec 20). Proposta.
 * `positionStep` é a folga entre cartões novos numa coluna.
 */
export const TASKS = {
  titleMaxChars: 200,
  descriptionMaxChars: 10_000,
  commentMaxChars: 2_000,
  tagMaxChars: 30,
  maxTags: 10,
  maxSubtasks: 50,
  maxPomodorosEstimated: 100,
  positionStep: 1024,
} as const;

/**
 * Joias (spec 18): a moeda do jogo. Ganhas com cuidado e foco, gastas na casa e no quarto.
 * O saldo é calculado a partir dos registros, nunca gravado. Proposta.
 */
export const JOIAS = {
  /** Joias por cada coisa feita. */
  por: { habitDone: 1, restDay: 2, milestoneDone: 3, goalCompleted: 10 },
  /** O foco rende 1 joia a cada tantos minutos focados, por sessão terminada (até o tempo planejado). */
  focusMinutesPerJoia: 5,
} as const;

/** Casa do sapo (spec 18): preço de cada parte, em joias. O quarto (preço 0) já vem pronto. Sem ordem obrigatória. Proposta. */
export const HOUSE = {
  partCost: { quarto: 0, cozinha: 120, varanda: 80, jardim: 60, arvore: 90, cerca: 40 },
} as const;

/** Decorações do quarto (spec 18): preço em joias. O quarto começa vazio. Proposta. */
export const ROOM_DECOR = {
  itemCost: { tapete: 10, vaso: 15, luminaria: 25, quadro: 30, estante: 45, poltrona: 60, aquario: 80 },
} as const;

/** Grade do chão do quarto (`x` de 0 a columns - 1, `y` de 0 a rows - 1) e giros possíveis, em graus. Proposta. */
export const ROOM_GRID = { columns: 6, rows: 6, rotations: [0, 90, 180, 270] } as const;

/**
 * Conquistas (spec 14): catálogo na ordem em que aparecem. `meta` é o alvo numérico de cada regra
 * (`@pulo/core/domain/achievements`): dias seguidos, minutos de uma sessão de foco, dias de descanso, partes da casa
 * ou gelos usados.
 * A regra da secreta ainda não foi escolhida: ela não é concedida a ninguém. Proposta.
 */
export const ACHIEVEMENTS = [
  { id: 'primeira-semana', nome: 'Primeira semana', emoji: '🔥', secreta: false, meta: 7 },
  { id: 'foco-profundo', nome: 'Foco profundo', emoji: '⏱️', secreta: false, meta: 50 },
  { id: 'descanso-sabido', nome: 'Descanso sabido', emoji: '🌙', secreta: false, meta: 4 },
  { id: 'mes-de-fogo', nome: 'Mês de fogo', emoji: '🏆', secreta: false, meta: 30 },
  { id: 'casa-inteira', nome: 'Casa inteira', emoji: '🏡', secreta: false, meta: Object.keys(HOUSE.partCost).length },
  { id: 'gelo-na-hora', nome: 'Gelo na hora certa', emoji: '🧊', secreta: false, meta: 1 },
  { id: 'segredo', nome: 'Segredo', emoji: '✨', secreta: true, meta: 1 },
] as const;

/**
 * Ilha antiga (spec 12), em modo legado até a tela nova: catálogo de áreas e enfeites. As compras dela
 * não gastam joias na casa nem no quarto (o valor volta para a pessoa).
 */
export const ISLAND = {
  /** Preço para abrir cada área, na ordem do mapa. A primeira já vem aberta. */
  areaCost: { lagoa: 0, praia: 40, bosque: 90, cachoeira: 160, farol: 250 },
  /** Preço de cada enfeite. Um enfeite só pode ser comprado com a área dele aberta. */
  decorCost: {
    banco: 8,
    lanterna: 12,
    ponte: 20,
    guardaSol: 10,
    castelo: 15,
    barco: 25,
    cogumelos: 12,
    balanco: 18,
    casaNaArvore: 35,
    arcoIris: 15,
    pedras: 20,
    deck: 40,
    bandeirinhas: 15,
    telescopio: 25,
    fogueira: 30,
  },
} as const;

/** Foco (Pomodoro por horário). Proposta. */
export const FOCUS = {
  defaultMinutes: 25,
  minMinutes: 15,
  maxMinutes: 50,
  defaultBreakMinutes: 5,
  minBreakMinutes: 3,
  maxBreakMinutes: 15,
  /** Intenção do foco, em texto curto (spec 19). */
  intentionMaxChars: 140,
} as const;

/** Sons de fundo do foco (spec 15). */
export const AMBIENT_SOUNDS = ['silencio', 'lagoa', 'chuva'] as const;

/**
 * Preferências da conta (spec 15): o que vale enquanto a pessoa não escolhe, e os limites. A duração do foco e da pausa
 * seguem os limites de `FOCUS`; a meta diária nasce vazia (sem meta). Proposta.
 */
export const PREFERENCES = {
  eveningReminderMinutes: 21 * 60,
  minDailyFocusGoalMinutes: 5,
  maxDailyFocusGoalMinutes: 480,
  sounds: true,
  aiEnabled: true,
  ambientSound: 'silencio',
  /** Períodos de férias guardados; passando disso, o mais antigo sai. */
  maxVacationPeriods: 200,
} as const;

/**
 * Conta (spec 15). `deleteConfirmation` é a palavra que o corpo de `DELETE /api/account` precisa trazer. Proposta.
 */
export const ACCOUNT = {
  deleteConfirmation: 'EXCLUIR',
  nameMaxChars: 80,
  imageUrlMaxChars: 2048,
} as const;

/** Duração dos eventos transitórios do sapo, em ms. */
export const FROG_EVENT_MS = {
  pouso: 1200,
  surpreso: 3000,
  feliz: 4000,
} as const;

/** A partir deste número de focos interrompidos no dia, o sapo fica cansado. */
export const FROG_TIRED_MIN_INTERRUPTED = 2;

/** IA semanal e candidatas por regra. Propostas. */
export const WEEKLY_AI = {
  minDaysWithRecord: 3,
  minSessions: 5,
  /** Sessões num período para ele entrar na comparação entre períodos. */
  minSessionsPerPeriodToCount: 3,
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
