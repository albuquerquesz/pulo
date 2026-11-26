import type { Achievement, FocusSession, FreezeSummary, Goal, GoalChest, Habit, HabitLog, IslandPurchase, MascotState, ProposalChange, RestDay, RoomDecor, RoutineBlock, Streak, Task, TaskSubtask, User, WeeklyProposal } from '@pulo/core/domain/types';

// Cópias explícitas e tipadas (sem JSON.parse nem structuredClone, que perdem o tipo ou faltam no Hermes).

export const cloneBlock = (b: RoutineBlock): RoutineBlock => ({ ...b });
/** Tira o `active` que a API ainda manda para o web antigo: quem vale é o `state`. */
export const cloneHabit = (h: Habit & { active?: boolean }): Habit => {
  const { active: _legado, ...habit } = h;
  return { ...habit, weekdays: [...h.weekdays] };
};
export const cloneHabitLog = (l: HabitLog): HabitLog => ({ ...l });
export const cloneSession = (s: FocusSession): FocusSession => ({ ...s });
export const cloneRestDay = (r: RestDay): RestDay => ({ ...r });
export const cloneMascot = (m: MascotState): MascotState => ({ ...m });
export const cloneUser = (u: User): User => ({ ...u });

const cloneChange = (c: ProposalChange): ProposalChange => ({ ...c, from: { ...c.from }, to: { ...c.to } });
export const cloneProposal = (p: WeeklyProposal): WeeklyProposal => ({ ...p, changes: p.changes.map(cloneChange) });

export const cloneGoal = (g: Goal): Goal => ({ ...g, milestones: g.milestones.map((m) => ({ ...m })) });

export const cloneGoalChest = (b: GoalChest): GoalChest => ({ ...b });

export const cloneIslandPurchase = (p: IslandPurchase): IslandPurchase => ({ ...p });

export const cloneRoomDecor = (d: RoomDecor): RoomDecor => ({ ...d });

export const cloneStreak = (s: Streak): Streak => ({ ...s, semana: s.semana.map((d) => ({ ...d })) });

export const cloneAchievement = (a: Achievement): Achievement => ({ ...a });

export const cloneFreezeSummary = (f: FreezeSummary): FreezeSummary => ({ ...f, recentes: [...f.recentes] });

export const cloneTask = (t: Task): Task => ({ ...t, tags: [...t.tags] });
export const cloneSubtask = (s: TaskSubtask): TaskSubtask => ({ ...s });
