import type { Prisma } from '@pulo/db';

/**
 * Colunas lidas de cada tabela (nunca `userId`: a rota já sabe de quem é). Cada `select` serve de entrada
 * para o `toDomain` do mapeador correspondente. Sem `select` aberto, só o que a rota usa.
 */
export const blockSelect = {
  id: true,
  weekday: true,
  startMinutes: true,
  durationMinutes: true,
  kind: true,
  title: true,
} as const satisfies Prisma.RoutineBlockSelect;

export const habitSelect = { id: true, title: true, weekdays: true, active: true } as const satisfies Prisma.HabitSelect;

export const habitLogSelect = { habitId: true, date: true, doneAt: true } as const satisfies Prisma.HabitLogSelect;

export const sessionSelect = {
  id: true,
  blockId: true,
  startedAt: true,
  endedAt: true,
  plannedMinutes: true,
  state: true,
  pausedMs: true,
  pausedSince: true,
} as const satisfies Prisma.FocusSessionSelect;

export const restDaySelect = { date: true } as const satisfies Prisma.RestDaySelect;

export const proposalSelect = {
  id: true,
  weekStart: true,
  state: true,
  patternText: true,
  reasonText: true,
  changes: true,
  origin: true,
  createdAt: true,
  decidedAt: true,
} as const satisfies Prisma.WeeklyProposalSelect;

export const mascotSelect = { phase: true, careDays: true, updatedAt: true } as const satisfies Prisma.MascotStateSelect;

export const goalSelect = {
  id: true,
  title: true,
  why: true,
  targetDate: true,
  state: true,
  milestones: true,
  createdAt: true,
  completedAt: true,
} as const satisfies Prisma.GoalSelect;

export const islandPurchaseSelect = { item: true, cost: true, createdAt: true } as const satisfies Prisma.IslandPurchaseSelect;
