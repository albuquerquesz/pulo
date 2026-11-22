import type {
  CheckIn,
  FocusSession,
  Habit,
  HabitLog,
  MascotState,
  Repository,
  RestDay,
  RoutineBlock,
  User,
  WeeklyProposal,
} from '@/domain/types';

/** Repositório mínimo em memória, só para testes do demo. O real vive em src/data. */
export function createFakeRepository(): Repository {
  let user: User | null = null;
  let mascot: MascotState | null = null;
  const blocks = new Map<string, RoutineBlock>();
  const habits = new Map<string, Habit>();
  let logs: HabitLog[] = [];
  const sessions = new Map<string, FocusSession>();
  const checkIns = new Map<string, CheckIn>();
  const rest = new Map<string, RestDay>();
  const proposals = new Map<string, WeeklyProposal>();
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
    listCheckIns: async (r) => [...checkIns.values()].filter((c) => inRange(c.date, r)),
    saveCheckIn: async (c) => void checkIns.set(c.id, c),
    listRestDays: async () => [...rest.values()],
    saveRestDay: async (r) => void rest.set(r.date, r),
    deleteRestDay: async (d) => void rest.delete(d),
    listProposals: async () => [...proposals.values()],
    saveProposal: async (p) => void proposals.set(p.id, p),
    getMascotState: async () => mascot,
    saveMascotState: async (m) => void (mascot = m),
    clearAll: async () => {
      user = null;
      mascot = null;
      blocks.clear();
      habits.clear();
      logs = [];
      sessions.clear();
      checkIns.clear();
      rest.clear();
      proposals.clear();
    },
  };
}
