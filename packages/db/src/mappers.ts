import type {
  BlockSlot,
  FocusSession,
  Goal,
  GoalChest,
  GoalMilestone,
  Habit,
  HabitLog,
  IslandPurchase,
  RoomDecor,
  RoomRotation,
  RoomSpot,
  MascotState,
  Phase,
  ProposalChange,
  RestDay,
  RoutineBlock,
  Task,
  TaskComment,
  TaskEvent,
  TaskSubtask,
  UnlockedAchievement,
  Weekday,
  WeeklyProposal,
} from '@pulo/core/domain/types';
import { z } from 'zod';
import { dateKeyToDate, dateToDateKey, dateToMs, msToDate } from './dates';
import type {
  Prisma,
  Achievement as AchievementRow,
  FocusSession as FocusSessionRow,
  Goal as GoalRow,
  GoalChest as GoalChestRow,
  Habit as HabitRow,
  HabitLog as HabitLogRow,
  IslandPurchase as IslandPurchaseRow,
  MascotState as MascotStateRow,
  RestDay as RestDayRow,
  RoutineBlock as RoutineBlockRow,
  Task as TaskRow,
  TaskComment as TaskCommentRow,
  TaskEvent as TaskEventRow,
  TaskSubtask as TaskSubtaskRow,
  WeeklyProposal as WeeklyProposalRow,
} from '#client';

/**
 * Mapeadores entre as linhas do Prisma e as entidades de `@pulo/core/domain/types`.
 * `toDomain` lê uma linha; `fromDomain(userId, entidade)` monta o `data` do create/upsert.
 * Sem `any` e sem `as`: valores fora do domínio lançam `RangeError` (o CHECK do banco os impede).
 */

// ---------- Guardas sem cast ----------

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const satisfies readonly Weekday[];
const PHASES = [1, 2, 3, 4] as const satisfies readonly Phase[];

export function toWeekday(value: number): Weekday {
  const found = WEEKDAYS.find((weekday) => weekday === value);
  if (found === undefined) throw new RangeError(`weekday fora de 0 a 6: ${value}`);
  return found;
}

export function toPhase(value: number): Phase {
  const found = PHASES.find((phase) => phase === value);
  if (found === undefined) throw new RangeError(`fase fora de 1 a 4: ${value}`);
  return found;
}

// ---------- Json tipado ----------

const blockSlotSchema = z.object({
  weekday: z.number().transform(toWeekday),
  startMinutes: z.number(),
  durationMinutes: z.number(),
}) satisfies z.ZodType<BlockSlot, unknown>;

const proposalChangeSchema = z.object({
  kind: z.enum(['mover_foco', 'encurtar_foco']),
  blockId: z.string(),
  from: blockSlotSchema,
  to: blockSlotSchema,
}) satisfies z.ZodType<ProposalChange, unknown>;

/** Valida o Json `changes` lido do banco e devolve `ProposalChange[]` tipado. */
export const proposalChangesSchema = z.array(proposalChangeSchema);

// ---------- RoutineBlock ----------

export const routineBlockMapper = {
  toDomain(row: Omit<RoutineBlockRow, 'userId'>): RoutineBlock {
    return {
      id: row.id,
      weekday: toWeekday(row.weekday),
      startMinutes: row.startMinutes,
      durationMinutes: row.durationMinutes,
      kind: row.kind,
      ...(row.title === null ? {} : { title: row.title }),
      ...(row.icon === null ? {} : { icon: row.icon }),
    };
  },
  fromDomain(userId: string, block: Omit<RoutineBlock, 'icon'> & { icon?: string | null }): Prisma.RoutineBlockUncheckedCreateInput {
    // `icon` ausente: a coluna não é tocada na atualização; `null` tira.
    return {
      id: block.id,
      userId,
      weekday: block.weekday,
      startMinutes: block.startMinutes,
      durationMinutes: block.durationMinutes,
      kind: block.kind,
      title: block.title ?? null,
      ...(block.icon === undefined ? {} : { icon: block.icon }),
    };
  },
};

// ---------- Habit ----------

/** Campos opcionais do hábito na escrita: ausente não toca a coluna, `null` limpa. */
type HabitWrite = Pick<Habit, 'id' | 'title' | 'weekdays' | 'state' | 'reminderOn'> & {
  goalId?: string | null;
  icon?: string | null;
  color?: Habit['color'] | null;
  period?: Habit['period'] | null;
  reminderMinutes?: number | null;
};

export const habitMapper = {
  toDomain(row: Omit<HabitRow, 'userId' | 'active' | 'createdAt'>): Habit {
    return {
      id: row.id,
      title: row.title,
      weekdays: row.weekdays.map(toWeekday),
      state: row.state,
      ...(row.goalId === null ? {} : { goalId: row.goalId }),
      ...(row.icon === null ? {} : { icon: row.icon }),
      ...(row.color === null ? {} : { color: row.color }),
      ...(row.period === null ? {} : { period: row.period }),
      ...(row.reminderMinutes === null ? {} : { reminderMinutes: row.reminderMinutes }),
      ...(row.reminderOn ? { reminderOn: true } : {}),
    };
  },
  fromDomain(userId: string, habit: HabitWrite): Prisma.HabitUncheckedCreateInput {
    return {
      id: habit.id,
      userId,
      title: habit.title,
      weekdays: habit.weekdays,
      state: habit.state,
      ...(habit.goalId === undefined ? {} : { goalId: habit.goalId }),
      ...(habit.icon === undefined ? {} : { icon: habit.icon }),
      ...(habit.color === undefined ? {} : { color: habit.color }),
      ...(habit.period === undefined ? {} : { period: habit.period }),
      ...(habit.reminderMinutes === undefined ? {} : { reminderMinutes: habit.reminderMinutes }),
      ...(habit.reminderOn === undefined ? {} : { reminderOn: habit.reminderOn }),
    };
  },
};

// ---------- HabitLog ----------

export const habitLogMapper = {
  toDomain(row: Omit<HabitLogRow, 'userId'>): HabitLog {
    return { habitId: row.habitId, date: dateToDateKey(row.date), doneAt: dateToMs(row.doneAt) };
  },
  fromDomain(userId: string, log: HabitLog): Prisma.HabitLogUncheckedCreateInput {
    return { habitId: log.habitId, userId, date: dateKeyToDate(log.date), doneAt: msToDate(log.doneAt) };
  },
};

// ---------- FocusSession ----------

export const focusSessionMapper = {
  toDomain(row: Omit<FocusSessionRow, 'userId'>): FocusSession {
    return {
      id: row.id,
      startedAt: dateToMs(row.startedAt),
      plannedMinutes: row.plannedMinutes,
      state: row.state,
      pausedMs: row.pausedMs,
      ...(row.blockId === null ? {} : { blockId: row.blockId }),
      ...(row.endedAt === null ? {} : { endedAt: dateToMs(row.endedAt) }),
      ...(row.pausedSince === null ? {} : { pausedSince: dateToMs(row.pausedSince) }),
      ...(row.intention === null ? {} : { intention: row.intention }),
      ...(row.habitId === null ? {} : { habitId: row.habitId }),
      ...(row.goalId === null ? {} : { goalId: row.goalId }),
      ...(row.taskId === null ? {} : { taskId: row.taskId }),
    };
  },
  fromDomain(userId: string, session: FocusSession): Prisma.FocusSessionUncheckedCreateInput {
    return {
      id: session.id,
      userId,
      blockId: session.blockId ?? null,
      startedAt: msToDate(session.startedAt),
      endedAt: session.endedAt === undefined ? null : msToDate(session.endedAt),
      plannedMinutes: session.plannedMinutes,
      state: session.state,
      pausedMs: session.pausedMs,
      pausedSince: session.pausedSince === undefined ? null : msToDate(session.pausedSince),
      intention: session.intention ?? null,
      habitId: session.habitId ?? null,
      goalId: session.goalId ?? null,
      taskId: session.taskId ?? null,
    };
  },
};

// ---------- RestDay ----------

export const restDayMapper = {
  toDomain(row: Omit<RestDayRow, 'userId'>): RestDay {
    return { date: dateToDateKey(row.date) };
  },
  fromDomain(userId: string, restDay: RestDay): Prisma.RestDayUncheckedCreateInput {
    return { userId, date: dateKeyToDate(restDay.date) };
  },
};

// ---------- WeeklyProposal ----------

function slotToJson(slot: BlockSlot): Prisma.InputJsonObject {
  return { weekday: slot.weekday, startMinutes: slot.startMinutes, durationMinutes: slot.durationMinutes };
}

/** Interfaces não têm index signature, então o JSON é montado campo a campo (sem cast). */
function changeToJson(change: ProposalChange): Prisma.InputJsonObject {
  return { kind: change.kind, blockId: change.blockId, from: slotToJson(change.from), to: slotToJson(change.to) };
}

export const weeklyProposalMapper = {
  toDomain(row: Omit<WeeklyProposalRow, 'userId'>): WeeklyProposal {
    return {
      id: row.id,
      weekStart: dateToDateKey(row.weekStart),
      state: row.state,
      patternText: row.patternText,
      changes: proposalChangesSchema.parse(row.changes),
      origin: row.origin,
      createdAt: dateToMs(row.createdAt),
      ...(row.reasonText === null ? {} : { reasonText: row.reasonText }),
      ...(row.decidedAt === null ? {} : { decidedAt: dateToMs(row.decidedAt) }),
    };
  },
  fromDomain(userId: string, proposal: WeeklyProposal): Prisma.WeeklyProposalUncheckedCreateInput {
    return {
      id: proposal.id,
      userId,
      weekStart: dateKeyToDate(proposal.weekStart),
      state: proposal.state,
      patternText: proposal.patternText,
      reasonText: proposal.reasonText ?? null,
      changes: proposal.changes.map(changeToJson),
      origin: proposal.origin,
      createdAt: msToDate(proposal.createdAt),
      decidedAt: proposal.decidedAt === undefined ? null : msToDate(proposal.decidedAt),
    };
  },
};

// ---------- Goal ----------

const goalMilestoneSchema = z.object({
  id: z.string(),
  title: z.string(),
  doneAt: z.number().optional(),
}) satisfies z.ZodType<GoalMilestone, unknown>;

/** Valida o Json `milestones` lido do banco e devolve `GoalMilestone[]` tipado. */
export const goalMilestonesSchema = z.array(goalMilestoneSchema);

function milestoneToJson(milestone: GoalMilestone): Prisma.InputJsonObject {
  return { id: milestone.id, title: milestone.title, ...(milestone.doneAt === undefined ? {} : { doneAt: milestone.doneAt }) };
}

export const goalMapper = {
  toDomain(row: Omit<GoalRow, 'userId'>): Goal {
    return {
      id: row.id,
      title: row.title,
      state: row.state,
      milestones: goalMilestonesSchema.parse(row.milestones),
      createdAt: dateToMs(row.createdAt),
      ...(row.why === null ? {} : { why: row.why }),
      ...(row.targetDate === null ? {} : { targetDate: dateToDateKey(row.targetDate) }),
      ...(row.completedAt === null ? {} : { completedAt: dateToMs(row.completedAt) }),
      ...(row.icon === null ? {} : { icon: row.icon }),
      ...(row.color === null ? {} : { color: row.color }),
    };
  },
  fromDomain(userId: string, goal: Goal): Prisma.GoalUncheckedCreateInput {
    return {
      id: goal.id,
      userId,
      title: goal.title,
      why: goal.why ?? null,
      targetDate: goal.targetDate === undefined ? null : dateKeyToDate(goal.targetDate),
      state: goal.state,
      milestones: goal.milestones.map(milestoneToJson),
      createdAt: msToDate(goal.createdAt),
      completedAt: goal.completedAt === undefined ? null : msToDate(goal.completedAt),
      // Ausentes não apagam o que está gravado: clientes antigos não mandam ícone nem cor.
      ...(goal.icon === undefined ? {} : { icon: goal.icon }),
      ...(goal.color === undefined ? {} : { color: goal.color }),
    };
  },
};

export const goalChestMapper = {
  toDomain(row: Omit<GoalChestRow, 'userId'>): GoalChest {
    return { goalId: row.goalId, abertoEm: dateToMs(row.abertoEm), joias: row.joias };
  },
  fromDomain(userId: string, chest: GoalChest): Prisma.GoalChestUncheckedCreateInput {
    return { userId, goalId: chest.goalId, abertoEm: msToDate(chest.abertoEm), joias: chest.joias };
  },
};

// ---------- Achievement ----------

export const achievementMapper = {
  toDomain(row: Omit<AchievementRow, 'userId'>): UnlockedAchievement {
    return { id: row.achievement, conquistadaEm: dateToMs(row.conquistadaEm) };
  },
};

// ---------- IslandPurchase ----------

export const islandPurchaseMapper = {
  toDomain(row: Omit<IslandPurchaseRow, 'userId' | 'kind'>): IslandPurchase {
    return { item: row.item, cost: row.cost, createdAt: dateToMs(row.createdAt) };
  },
  fromDomain(userId: string, purchase: IslandPurchase): Prisma.IslandPurchaseUncheckedCreateInput {
    return { userId, item: purchase.item, cost: purchase.cost, createdAt: msToDate(purchase.createdAt) };
  },
};

// ---------- Quarto ----------

function toRotation(value: number): RoomRotation {
  if (value === 0 || value === 90 || value === 180 || value === 270) return value;
  throw new RangeError(`Giro fora do domínio: ${value}`);
}

type RoomDecorRow = Omit<IslandPurchaseRow, 'userId' | 'kind'> & { placement: { x: number; y: number; rotation: number } | null };

export const roomPlacementMapper = {
  toSpot(row: { x: number; y: number; rotation: number }): RoomSpot {
    return { x: row.x, y: row.y, rotation: toRotation(row.rotation) };
  },
  /** A compra de uma decoração junto com a posição. Sem posição o dado está quebrado. */
  toDomain(row: RoomDecorRow): RoomDecor {
    if (!row.placement) throw new RangeError(`Decoração sem posição: ${row.item}`);
    return { ...islandPurchaseMapper.toDomain(row), ...roomPlacementMapper.toSpot(row.placement) };
  },
};

// ---------- MascotState ----------

export const mascotStateMapper = {
  toDomain(row: Omit<MascotStateRow, 'userId'>): MascotState {
    return { phase: toPhase(row.phase), careDays: row.careDays, updatedAt: dateToMs(row.updatedAt) };
  },
  fromDomain(userId: string, state: MascotState): Prisma.MascotStateUncheckedCreateInput {
    return { userId, phase: state.phase, careDays: state.careDays, updatedAt: msToDate(state.updatedAt) };
  },
};

// ---------- Tarefas ----------

export const taskMapper = {
  toDomain(row: Omit<TaskRow, 'userId'>): Task {
    return {
      id: row.id,
      title: row.title,
      ...(row.description === null ? {} : { description: row.description }),
      status: row.status,
      position: row.position,
      priority: row.priority,
      ...(row.dueDate === null ? {} : { dueDate: dateToDateKey(row.dueDate) }),
      tags: row.tags,
      ...(row.goalId === null ? {} : { goalId: row.goalId }),
      pomodorosEstimated: row.pomodorosEstimated,
      createdAt: dateToMs(row.createdAt),
      ...(row.completedAt === null ? {} : { completedAt: dateToMs(row.completedAt) }),
    };
  },
  fromDomain(userId: string, task: Task): Prisma.TaskUncheckedCreateInput {
    return {
      id: task.id,
      userId,
      title: task.title,
      description: task.description ?? null,
      status: task.status,
      position: task.position,
      priority: task.priority,
      dueDate: task.dueDate === undefined ? null : dateKeyToDate(task.dueDate),
      tags: task.tags,
      goalId: task.goalId ?? null,
      pomodorosEstimated: task.pomodorosEstimated,
      createdAt: msToDate(task.createdAt),
      completedAt: task.completedAt === undefined ? null : msToDate(task.completedAt),
    };
  },
};

export const taskSubtaskMapper = {
  toDomain(row: Omit<TaskSubtaskRow, 'userId'>): TaskSubtask {
    return { id: row.id, taskId: row.taskId, title: row.title, done: row.done, position: row.position };
  },
  fromDomain(userId: string, subtask: TaskSubtask): Prisma.TaskSubtaskUncheckedCreateInput {
    const { id, taskId, title, done, position } = subtask;
    return { id, userId, taskId, title, done, position };
  },
};

export const taskCommentMapper = {
  toDomain(row: Omit<TaskCommentRow, 'userId'>): TaskComment {
    return { id: row.id, taskId: row.taskId, body: row.body, createdAt: dateToMs(row.createdAt) };
  },
  fromDomain(userId: string, comment: TaskComment): Prisma.TaskCommentUncheckedCreateInput {
    const { id, taskId, body, createdAt } = comment;
    return { id, userId, taskId, body, createdAt: msToDate(createdAt) };
  },
};

export const taskEventMapper = {
  toDomain(row: Omit<TaskEventRow, 'userId' | 'seq'>): TaskEvent {
    return {
      id: row.id,
      taskId: row.taskId,
      kind: row.kind,
      ...(row.de === null ? {} : { de: row.de }),
      ...(row.para === null ? {} : { para: row.para }),
      createdAt: dateToMs(row.createdAt),
    };
  },
};
