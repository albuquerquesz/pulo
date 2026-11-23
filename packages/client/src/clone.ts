import type { FocusSession, Habit, HabitLog, MascotState, ProposalChange, RestDay, RoutineBlock, User, WeeklyProposal } from '@pulo/core/domain/types';

// Cópias explícitas e tipadas (sem JSON.parse nem structuredClone, que perdem o tipo ou faltam no Hermes).

export const cloneBlock = (b: RoutineBlock): RoutineBlock => ({ ...b });
export const cloneHabit = (h: Habit): Habit => ({ ...h, weekdays: [...h.weekdays] });
export const cloneHabitLog = (l: HabitLog): HabitLog => ({ ...l });
export const cloneSession = (s: FocusSession): FocusSession => ({ ...s });
export const cloneRestDay = (r: RestDay): RestDay => ({ ...r });
export const cloneMascot = (m: MascotState): MascotState => ({ ...m });
export const cloneUser = (u: User): User => ({ ...u });

const cloneChange = (c: ProposalChange): ProposalChange => ({ ...c, from: { ...c.from }, to: { ...c.to } });
export const cloneProposal = (p: WeeklyProposal): WeeklyProposal => ({ ...p, changes: p.changes.map(cloneChange) });
