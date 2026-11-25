import { z } from 'zod';

import { ACCENT_COLORS,
  ACCOUNT,
  BLOCK_MAX_MINUTES,
  BLOCK_MIN_MINUTES,
  FOCUS,
  GOALS,
  MAX_HABITS_PER_DAY,
  ROOM_GRID,
  TASKS,
  WEEKLY_AI,
} from '../config/decisions';
import { addDays, isDateKey, weekdayOf } from '../domain/day';
import type {
  BlockSlot,
  DateKey,
  FocusSession,
  Goal,
  GoalMilestone,
  Habit,
  HabitLog,
  IslandPurchase,
  RoomDecor,
  RoomRotation,
  RoomSpot,
  MascotState,
  Phase,
  ProfileStats,
  ProposalChange,
  RestDay,
  RoutineBlock,
  Streak,
  Task,
  TaskComment,
  TaskEvent,
  TaskSubtask,
  Weekday,
  WeeklyProposal,
} from '../domain/types';

/**
 * Contrato da API REST do Pulo: os mesmos schemas validam o corpo no servidor (apps/api) e servem
 * ao app (cliente remoto do Repository). Cada schema de entidade tem a forma exata de
 * `domain/types.ts` (garantido por `satisfies`). Sem `any` e sem cast.
 */

// ---------- Primitivos ----------

const MINUTES_PER_DAY = 24 * 60;
/** Maior instante que o `Date` do JavaScript representa. */
const MAX_EPOCH_MS = 8_640_000_000_000_000;
/** Limite técnico (não é decisão de produto) dos textos livres. */
export const API_LIMITS = {
  titleMaxChars: 80,
  /** O porquê de uma meta. */
  goalWhyMaxChars: 200,
  proposalTextMaxChars: 280,
  idMaxChars: 64,
  /** Itens por escrita em lote (`PUT /api/blocks` e `PUT /api/habits`). O onboarding grava 15 blocos e 2 hábitos. */
  batchMaxBlocks: 100,
  batchMaxHabits: 50,
} as const;

/** Id gerado pelo cliente (uuid, ou o formato antigo `prefixo-xxx-n` do core). Entra em caminhos de URL. */
export const idSchema = z
  .string()
  .min(1)
  .max(API_LIMITS.idMaxChars)
  .regex(/^[A-Za-z0-9_-]+$/, 'id só aceita letras, números, hífen e sublinhado');

/** 'AAAA-MM-DD' de um dia que existe (rejeita 2026-02-31). */
export const dateKeySchema = z
  .string()
  .refine(isRealDateKey, { message: 'data inválida, use AAAA-MM-DD' })
  .meta({ description: 'Dia lógico no formato AAAA-MM-DD' });

function isRealDateKey(value: string): value is DateKey {
  if (!isDateKey(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Instante em ms desde a época. */
export const msSchema = z.number().int().min(0).max(MAX_EPOCH_MS);

export const weekdaySchema = z.number().refine(isWeekday, { message: 'dia da semana de 0 a 6' });
function isWeekday(value: number): value is Weekday {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

export const periodSchema = z.enum(['manha', 'tarde', 'noite']);

const phaseSchema = z.number().refine(isPhase, { message: 'fase de 1 a 4' });
function isPhase(value: number): value is Phase {
  return Number.isInteger(value) && value >= 1 && value <= 4;
}

const titleSchema = z.string().trim().min(1).max(API_LIMITS.titleMaxChars);

// ---------- Entidades ----------

export const routineBlockSchema = z
  .object({
    id: idSchema,
    weekday: weekdaySchema,
    startMinutes: z.number().int().min(0).max(MINUTES_PER_DAY - 1),
    durationMinutes: z.number().int().min(BLOCK_MIN_MINUTES).max(BLOCK_MAX_MINUTES),
    kind: z.enum(['foco', 'descanso']),
    title: titleSchema.optional(),
  })
  .refine((block) => block.startMinutes + block.durationMinutes <= MINUTES_PER_DAY, {
    message: 'o bloco precisa caber dentro do dia',
    path: ['durationMinutes'],
  }) satisfies z.ZodType<RoutineBlock, unknown>;

export const habitSchema = z.object({
  id: idSchema,
  title: titleSchema,
  weekdays: z.array(weekdaySchema).min(1).max(7),
  active: z.boolean(),
  goalId: idSchema.optional(),
}) satisfies z.ZodType<Habit, unknown>;

/** Corpo de escrita de um hábito. `goalId`: ausente mantém a meta gravada (clientes antigos), `null` solta. */
export const habitInputSchema = habitSchema.extend({ goalId: idSchema.nullable().optional() });

/** Ids repetidos no mesmo lote: o servidor não consegue gravar duas versões do mesmo item de uma vez. */
function uniqueIds(field: 'blocks' | 'habits') {
  return (batch: { blocks?: { id: string }[]; habits?: { id: string }[] }, ctx: z.RefinementCtx) => {
    const seen = new Set<string>();
    (batch[field] ?? []).forEach((item, index) => {
      if (seen.has(item.id)) ctx.addIssue({ code: 'custom', path: [field, index, 'id'], message: 'id repetido no mesmo lote' });
      seen.add(item.id);
    });
  };
}

/** Corpo de `PUT /api/blocks`: vários blocos de uma vez (tudo ou nada). Cada item segue `routineBlockSchema`. */
export const blocksBatchSchema = z
  .object({ blocks: z.array(routineBlockSchema).min(1).max(API_LIMITS.batchMaxBlocks) })
  .superRefine(uniqueIds('blocks'));

export const habitLogSchema = z.object({
  habitId: idSchema,
  date: dateKeySchema,
  doneAt: msSchema,
}) satisfies z.ZodType<HabitLog, unknown>;

export const focusSessionSchema = z
  .object({
    id: idSchema,
    blockId: idSchema.optional(),
    startedAt: msSchema,
    endedAt: msSchema.optional(),
    plannedMinutes: z.number().int().min(FOCUS.minMinutes).max(FOCUS.maxMinutes),
    state: z.enum(['em_andamento', 'concluida', 'interrompida']),
    pausedMs: z.number().int().min(0).max(MAX_EPOCH_MS),
    pausedSince: msSchema.optional(),
  })
  .superRefine((session, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (session.state === 'em_andamento') {
      if (session.endedAt !== undefined) issue('endedAt', 'sessão em andamento não tem endedAt');
    } else {
      if (session.endedAt === undefined) issue('endedAt', 'sessão encerrada precisa de endedAt');
      if (session.pausedSince !== undefined) issue('pausedSince', 'sessão encerrada não está pausada');
    }
    if (session.endedAt !== undefined) {
      if (session.endedAt < session.startedAt) issue('endedAt', 'endedAt antes de startedAt');
      else if (session.pausedMs > session.endedAt - session.startedAt) issue('pausedMs', 'pausa maior que a sessão');
    }
    if (session.pausedSince !== undefined && session.pausedSince < session.startedAt) {
      issue('pausedSince', 'pausa antes do início');
    }
  }) satisfies z.ZodType<FocusSession, unknown>;

export const restDaySchema = z.object({ date: dateKeySchema }) satisfies z.ZodType<RestDay, unknown>;

const blockSlotSchema = z
  .object({
    weekday: weekdaySchema,
    startMinutes: z.number().int().min(0).max(MINUTES_PER_DAY - 1),
    durationMinutes: z.number().int().min(BLOCK_MIN_MINUTES).max(BLOCK_MAX_MINUTES),
  })
  .refine((slot) => slot.startMinutes + slot.durationMinutes <= MINUTES_PER_DAY, {
    message: 'o horário precisa caber dentro do dia',
    path: ['durationMinutes'],
  }) satisfies z.ZodType<BlockSlot, unknown>;

export const proposalChangeSchema = z.object({
  kind: z.enum(['mover_foco', 'encurtar_foco']),
  blockId: idSchema,
  from: blockSlotSchema,
  to: blockSlotSchema,
}) satisfies z.ZodType<ProposalChange, unknown>;

export const PROPOSAL_STATES = ['pendente', 'aceita', 'editada', 'negada', 'expirada'] as const;

export const weeklyProposalSchema = z
  .object({
    id: idSchema,
    weekStart: dateKeySchema.refine((key) => weekdayOf(key) === 0, { message: 'weekStart precisa ser uma segunda' }),
    state: z.enum(PROPOSAL_STATES),
    patternText: z.string().trim().min(1).max(API_LIMITS.proposalTextMaxChars),
    reasonText: z.string().trim().min(1).max(API_LIMITS.proposalTextMaxChars).optional(),
    changes: z.array(proposalChangeSchema).max(WEEKLY_AI.maxChangesPerProposal),
    origin: z.enum(['ia', 'regra']),
    createdAt: msSchema,
    decidedAt: msSchema.optional(),
  })
  .superRefine((proposal, ctx) => {
    if (proposal.state === 'pendente' && proposal.decidedAt !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['decidedAt'], message: 'proposta pendente não tem decidedAt' });
    }
    if (proposal.state !== 'pendente' && proposal.decidedAt === undefined) {
      ctx.addIssue({ code: 'custom', path: ['decidedAt'], message: 'proposta decidida precisa de decidedAt' });
    }
  }) satisfies z.ZodType<WeeklyProposal, unknown>;

/** Corpo de `POST /api/proposals/generate`: o dia da semana desejada (padrão: hoje, no fuso da pessoa). */
export const generateProposalBodySchema = z.object({ date: dateKeySchema.optional() });
export type GenerateProposalBody = z.infer<typeof generateProposalBodySchema>;

export const PROPOSAL_OUTCOMES = ['conhecendo', 'existente', 'sem_candidata', 'proposta'] as const;
export type ProposalOutcomeKind = (typeof PROPOSAL_OUTCOMES)[number];

/** Resposta de `POST /api/proposals/generate`: `conhecendo` e `sem_candidata` não criam nada; os outros trazem a proposta. */
export const generateProposalResponseSchema = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('conhecendo') }),
  z.object({ outcome: z.literal('sem_candidata') }),
  z.object({ outcome: z.literal('existente'), proposal: weeklyProposalSchema }),
  z.object({ outcome: z.literal('proposta'), proposal: weeklyProposalSchema }),
]);
export type GenerateProposalResponse = z.infer<typeof generateProposalResponseSchema>;

export const PROPOSAL_ACTIONS = ['aceitar', 'editar', 'negar', 'desfazer'] as const;
export type ProposalAction = (typeof PROPOSAL_ACTIONS)[number];

/** Corpo de `POST /api/proposals/:id/decision`. `editar` traz qual mudança e o novo horário de destino. */
export const proposalDecisionBodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('aceitar') }),
  z.object({
    action: z.literal('editar'),
    change: z.object({
      index: z.number().int().min(0).max(WEEKLY_AI.maxChangesPerProposal - 1),
      to: blockSlotSchema,
    }),
  }),
  z.object({ action: z.literal('negar') }),
  z.object({ action: z.literal('desfazer') }),
]);
export type ProposalDecisionBody = z.infer<typeof proposalDecisionBodySchema>;

/** Resposta da decisão: a proposta já atualizada e TODOS os blocos da pessoa (com as mudanças aplicadas ou desfeitas). */
export const proposalDecisionResponseSchema = z.object({
  proposal: weeklyProposalSchema,
  blocks: z.array(routineBlockSchema),
});
export type ProposalDecisionResponse = z.infer<typeof proposalDecisionResponseSchema>;

export const mascotStateSchema = z.object({
  phase: phaseSchema,
  careDays: z.number().int().min(0),
  updatedAt: msSchema,
}) satisfies z.ZodType<MascotState, unknown>;

export const streakSchema = z.object({
  atual: z.number().int().min(0),
  recorde: z.number().int().min(0),
  semana: z
    .array(z.object({ date: dateKeySchema, estado: z.enum(['feito', 'descanso', 'vazio', 'hoje', 'futuro']) }))
    .length(7),
}) satisfies z.ZodType<Streak, unknown>;

/** Resposta de `GET /api/streak`. */
export const streakResponseSchema = z.object({ streak: streakSchema });

export const profileStatsSchema = z.object({
  habitosFeitos: z.number().int().min(0),
  minutosDeFoco: z.number().int().min(0),
  desde: msSchema,
}) satisfies z.ZodType<ProfileStats, unknown>;

/** Resposta de `GET /api/stats`. */
export const statsResponseSchema = z.object({ stats: profileStatsSchema });

// ---------- Conta (spec 15) ----------

/** Corpo de `POST /api/auth/update-user`: só nome e foto (`image: null` tira a foto). */
export const accountUpdateSchema = z.strictObject({
  name: z.string().trim().min(1).max(ACCOUNT.nameMaxChars).optional(),
  image: z.url({ protocol: /^https$/ }).max(ACCOUNT.imageUrlMaxChars).nullable().optional(),
});

/** Um aplicativo (Claude ou outro cliente MCP) com acesso à conta. */
export const mcpConnectionSchema = z.object({
  clientId: z.string(),
  /** Nome que o aplicativo deu no registro; `null` se não deu. */
  name: z.string().nullable(),
  scopes: z.array(z.string()),
  /** Quando a pessoa liberou o acesso pela primeira vez e pela última (ms). */
  connectedAt: msSchema,
  updatedAt: msSchema,
});
export type McpConnection = z.infer<typeof mcpConnectionSchema>;

/** Resposta de `GET /api/mcp/connections` (a mais recente primeiro). */
export const mcpConnectionsResponseSchema = z.object({ connections: z.array(mcpConnectionSchema) });

export const clientIdParamSchema = z.object({ clientId: z.string().min(1).max(200) });

/** Corpo de `DELETE /api/account`: a palavra de confirmação (sem ela, 400 `corpo_invalido`). */
export const deleteAccountBodySchema = z.object({ confirm: z.literal(ACCOUNT.deleteConfirmation) });

export const goalMilestoneSchema = z.object({
  id: idSchema,
  title: titleSchema,
  doneAt: msSchema.optional(),
}) satisfies z.ZodType<GoalMilestone, unknown>;

export const goalSchema = z
  .object({
    id: idSchema,
    title: titleSchema,
    why: z.string().trim().min(1).max(API_LIMITS.goalWhyMaxChars).optional(),
    targetDate: dateKeySchema.optional(),
    state: z.enum(['ativa', 'concluida']),
    milestones: z.array(goalMilestoneSchema).max(GOALS.maxMilestones),
    createdAt: msSchema,
    completedAt: msSchema.optional(),
    icon: z.string().trim().min(1).max(GOALS.iconMaxChars).regex(/^\S+$/).optional(),
    color: z.enum(ACCENT_COLORS).optional(),
  })
  .superRefine((goal, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (goal.state === 'ativa' && goal.completedAt !== undefined) issue('completedAt', 'meta ativa não tem completedAt');
    if (goal.state === 'concluida' && goal.completedAt === undefined) issue('completedAt', 'meta concluída precisa de completedAt');
    if (new Set(goal.milestones.map((m) => m.id)).size !== goal.milestones.length) issue('milestones', 'id de marco repetido');
  }) satisfies z.ZodType<Goal, unknown>;

const positionSchema = z.number();
const taskTitleSchema = z.string().trim().min(1).max(TASKS.titleMaxChars);

export const taskStatusSchema = z.enum(['ideias', 'afazer', 'fazendo', 'feito']);
export const taskPrioritySchema = z.enum(['normal', 'alta']);

export const taskSchema = z
  .object({
    id: idSchema,
    /** Só o servidor atribui; o que vier no corpo é ignorado. */
    number: z.number().int().min(1).optional(),
    title: taskTitleSchema,
    description: z.string().min(1).max(TASKS.descriptionMaxChars).optional(),
    status: taskStatusSchema,
    position: positionSchema,
    priority: taskPrioritySchema,
    dueDate: dateKeySchema.optional(),
    tags: z.array(z.string().trim().min(1).max(TASKS.tagMaxChars)).max(TASKS.maxTags),
    goalId: idSchema.optional(),
    pomodorosEstimated: z.number().int().min(0).max(TASKS.maxPomodorosEstimated),
    createdAt: msSchema,
    completedAt: msSchema.optional(),
  })
  .superRefine((task, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (task.status !== 'feito' && task.completedAt !== undefined) issue('completedAt', 'tarefa aberta não tem completedAt');
    if (task.status === 'feito' && task.completedAt === undefined) issue('completedAt', 'tarefa feita precisa de completedAt');
    if (new Set(task.tags).size !== task.tags.length) issue('tags', 'etiqueta repetida');
  }) satisfies z.ZodType<Task, unknown>;

export const taskSubtaskSchema = z.object({
  id: idSchema,
  taskId: idSchema,
  title: taskTitleSchema,
  done: z.boolean(),
  position: positionSchema,
}) satisfies z.ZodType<TaskSubtask, unknown>;

export const taskCommentSchema = z.object({
  id: idSchema,
  taskId: idSchema,
  body: z.string().trim().min(1).max(TASKS.commentMaxChars),
  createdAt: msSchema,
}) satisfies z.ZodType<TaskComment, unknown>;

export const taskEventSchema = z.object({
  id: idSchema,
  taskId: idSchema,
  kind: z.enum(['criada', 'status', 'prioridade', 'prazo']),
  de: z.string().optional(),
  para: z.string().optional(),
  createdAt: msSchema,
}) satisfies z.ZodType<TaskEvent, unknown>;

export const subtaskParamSchema = z.object({ id: idSchema, subId: idSchema });

/** Compra com joias (ilha antiga ou casa). `item` é um id de catálogo; o preço e o saldo quem confere é o servidor. */
export const islandPurchaseSchema = z.object({
  item: idSchema,
  cost: z.number().int().min(0),
  createdAt: msSchema,
}) satisfies z.ZodType<IslandPurchase, unknown>;

const rotationSchema = z.custom<RoomRotation>((v) => ROOM_GRID.rotations.some((r) => r === v), { message: 'giro inválido' });
const spotShape = {
  x: z.number().int().min(0).max(ROOM_GRID.columns - 1),
  y: z.number().int().min(0).max(ROOM_GRID.rows - 1),
  rotation: rotationSchema,
};

/** Corpo de `PATCH /api/room/:item`: só a posição. */
export const roomSpotSchema = z.object(spotShape) satisfies z.ZodType<RoomSpot, unknown>;

/** Corpo de `PUT /api/room/:item`: a compra com a posição inicial. */
export const roomDecorSchema = islandPurchaseSchema.extend(spotShape) satisfies z.ZodType<RoomDecor, unknown>;

/** Corpo de `PUT /api/habits`: vários hábitos de uma vez (tudo ou nada). Cada item segue `habitInputSchema`. */
export const habitsBatchSchema = z
  .object({ habits: z.array(habitInputSchema).min(1).max(API_LIMITS.batchMaxHabits) })
  .superRefine(uniqueIds('habits'));

// ---------- Consultas ----------

const optionalDate = dateKeySchema.optional();

/** `?from=AAAA-MM-DD&to=AAAA-MM-DD`, os dois opcionais (sem limite de um lado). */
export const dateRangeQuerySchema = z
  .object({ from: optionalDate, to: optionalDate })
  .refine((range) => range.from === undefined || range.to === undefined || range.from <= range.to, {
    message: 'from deve ser menor ou igual a to',
    path: ['from'],
  });
export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;

/** Intervalo obrigatório e limitado (usado por /api/sync). */
export const SYNC_MAX_DAYS = 400;
export const syncQuerySchema = z
  .object({ from: dateKeySchema, to: dateKeySchema })
  .refine((range) => range.from <= range.to, { message: 'from deve ser menor ou igual a to', path: ['from'] })
  .refine((range) => range.to <= addDays(range.from, SYNC_MAX_DAYS), {
    message: `o intervalo vai até ${SYNC_MAX_DAYS} dias`,
    path: ['to'],
  });

export const weekSummaryQuerySchema = z.object({ date: dateKeySchema });

// ---------- Parâmetros de caminho ----------

export const idParamSchema = z.object({ id: idSchema });
export const dateParamSchema = z.object({ date: dateKeySchema });
export const habitLogParamSchema = z.object({ habitId: idSchema, date: dateKeySchema });
export const islandItemParamSchema = z.object({ item: idSchema });

// ---------- Erros ----------

/** Códigos estáveis de erro (corpo `{ error, message? }`). Ver docs/api.md. */
export const API_ERROR_CODES = [
  'nao_autenticado',
  'origem_nao_permitida',
  'origem_ausente',
  'corpo_invalido',
  'consulta_invalida',
  'parametro_invalido',
  'id_divergente',
  'data_divergente',
  'horario_no_futuro',
  'nao_encontrado',
  'referencia_inexistente',
  'rota_inexistente',
  'conflito_de_id',
  'limite_por_dia',
  'limite_de_metas',
  'meta_inexistente',
  'meta_nao_concluida',
  'bau_ja_aberto',
  'limite_de_subtarefas',
  'item_inexistente',
  'preco_divergente',
  'ja_comprado',
  'area_fechada',
  'fora_de_ordem',
  'joias_insuficientes',
  'sessao_em_andamento',
  'sessao_encerrada',
  'sessao_imutavel',
  'proposta_transicao_invalida',
  'proposta_imutavel',
  'semana_ja_tem_proposta',
  'bloco_mudou',
  'horario_ocupado',
  'conflito_concorrente',
  'erro_interno',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const apiErrorSchema = z.object({
  error: z.enum(API_ERROR_CODES),
  message: z.string().optional(),
  /** Campos inválidos, só nos erros 400 de validação. */
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export { MAX_HABITS_PER_DAY };
