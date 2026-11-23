import type {
  BlockSlot,
  FocusSession,
  Goal,
  GoalMilestone,
  Habit,
  HabitLog,
  MascotState,
  Phase,
  ProposalChange,
  RestDay,
  RoutineBlock,
  Weekday,
  WeeklyProposal,
} from '@pulo/core/domain/types';
import { z } from 'zod';
import { dateKeyToDate, dateToDateKey, dateToMs, msToDate } from './dates';
import type {
  Prisma,
  FocusSession as FocusSessionRow,
  Goal as GoalRow,
  Habit as HabitRow,
  HabitLog as HabitLogRow,
  MascotState as MascotStateRow,
  RestDay as RestDayRow,
  RoutineBlock as RoutineBlockRow,
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
    };
  },
  fromDomain(userId: string, block: RoutineBlock): Prisma.RoutineBlockUncheckedCreateInput {
    return {
      id: block.id,
      userId,
      weekday: block.weekday,
      startMinutes: block.startMinutes,
      durationMinutes: block.durationMinutes,
      kind: block.kind,
      title: block.title ?? null,
    };
  },
};

// ---------- Habit ----------

export const habitMapper = {
  toDomain(row: Omit<HabitRow, 'userId'>): Habit {
    return { id: row.id, title: row.title, weekdays: row.weekdays.map(toWeekday), active: row.active };
  },
  fromDomain(userId: string, habit: Habit): Prisma.HabitUncheckedCreateInput {
    return { id: habit.id, userId, title: habit.title, weekdays: habit.weekdays, active: habit.active };
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
    };
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
