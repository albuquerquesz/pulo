import type {
  FocusSession,
  Goal,
  GoalChest,
  IslandPurchase,
  Purchase,
  RoomDecor,
  Habit,
  HabitLog,
  MascotState,
  Repository,
  RestDay,
  RoutineBlock,
  Task,
  TaskComment,
  TaskSubtask,
  User,
  WeeklyProposal,
} from '../domain/types';

/** Repositório mínimo em memória, só para testes do demo. O real vive em src/data. */
export function createFakeRepository(): Repository {
  let user: User | null = null;
  let mascot: MascotState | null = null;
  const blocks = new Map<string, RoutineBlock>();
  const habits = new Map<string, Habit>();
  let logs: HabitLog[] = [];
  const sessions = new Map<string, FocusSession>();
  const rest = new Map<string, RestDay>();
  const proposals = new Map<string, WeeklyProposal>();
  const goals = new Map<string, Goal>();
  const baus = new Map<string, GoalChest>();
  const compras = new Map<string, IslandPurchase>();
  const casa = new Map<string, Purchase>();
  const quarto = new Map<string, RoomDecor>();
  const tasks = new Map<string, Task>();
  const subtasks = new Map<string, TaskSubtask>();
  const comments = new Map<string, TaskComment>();
  const inRange = (d: string, r?: { from: string; to: string }) => !r || (d >= r.from && d <= r.to);
  return {
    getUser: async () => user,
    saveUser: async (u) => void (user = u),
    listBlocks: async () => [...blocks.values()],
    saveBlock: async (b) => void blocks.set(b.id, b),
    deleteBlock: async (id) => void blocks.delete(id),
    listHabits: async () => [...habits.values()],
    saveHabit: async (h) => void habits.set(h.id, h),
    deleteHabit: async (id) => void habits.delete(id),
    listHabitLogs: async (r) => logs.filter((l) => inRange(l.date, r)),
    saveHabitLog: async (l) => {
      logs = logs.filter((x) => !(x.habitId === l.habitId && x.date === l.date));
      logs.push(l);
    },
    deleteHabitLog: async (h, d) => void (logs = logs.filter((l) => !(l.habitId === h && l.date === d))),
    listSessions: async () => [...sessions.values()],
    saveSession: async (s) => void sessions.set(s.id, s),
    listRestDays: async () => [...rest.values()],
    saveRestDay: async (r) => void rest.set(r.date, r),
    deleteRestDay: async (d) => void rest.delete(d),
    listProposals: async () => [...proposals.values()],
    saveProposal: async (p) => void proposals.set(p.id, p),
    listGoals: async () => [...goals.values()],
    saveGoal: async (g) => void goals.set(g.id, g),
    deleteGoal: async (id) => {
      goals.delete(id);
      baus.delete(id);
      for (const h of habits.values()) {
        if (h.goalId !== id) continue;
        const { goalId: _goalId, ...solto } = h;
        habits.set(h.id, solto);
      }
    },
    listGoalChests: async () => [...baus.values()],
    saveGoalChest: async (b) => void (baus.has(b.goalId) || baus.set(b.goalId, b)),
    listIslandPurchases: async () => [...compras.values()],
    saveIslandPurchase: async (c) => void compras.set(c.item, c),
    listHousePurchases: async () => [...casa.values()],
    saveHousePurchase: async (c) => void casa.set(c.item, c),
    listRoomDecor: async () => [...quarto.values()],
    saveRoomDecor: async (d) => void quarto.set(d.item, d),
    moveRoomDecor: async (item, spot) => {
      const atual = quarto.get(item);
      if (atual) quarto.set(item, { ...atual, ...spot });
    },
    getJoiaCredit: async () => 0,
    listTasks: async () => [...tasks.values()],
    saveTask: async (t) => void tasks.set(t.id, t),
    deleteTask: async (id) => void tasks.delete(id),
    listSubtasks: async () => [...subtasks.values()],
    saveSubtask: async (s) => void subtasks.set(s.id, s),
    deleteSubtask: async (_taskId, id) => void subtasks.delete(id),
    addTaskComment: async (c) => void comments.set(c.id, c),
    listTaskActivity: async (taskId) => ({ events: [], comments: [...comments.values()].filter((c) => c.taskId === taskId) }),
    getMascotState: async () => mascot,
    saveMascotState: async (m) => void (mascot = m),
    clearAll: async () => {
      user = null;
      mascot = null;
      blocks.clear();
      habits.clear();
      logs = [];
      sessions.clear();
      rest.clear();
      proposals.clear();
      goals.clear();
      baus.clear();
      compras.clear();
      casa.clear();
      quarto.clear();
      tasks.clear();
      subtasks.clear();
      comments.clear();
    },
  };
}
