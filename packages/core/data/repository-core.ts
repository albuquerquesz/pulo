import type {
  DateKey,
  DateRange,
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
  Clock,
  Task,
  TaskComment,
  TaskEvent,
  TaskSubtask,
  User,
  WeeklyProposal,
} from '../domain/types';
import { systemClock } from '../domain/clock';
import { newId } from '../domain/ids';
import { taskChanges } from '../domain/tasks';
import type { LinkKey } from '../domain/foco/targets';

/** Formato persistido. Versionado para migrações futuras. */
export interface Database {
  version: 1;
  user: User | null;
  blocks: RoutineBlock[];
  habits: Habit[];
  habitLogs: HabitLog[];
  sessions: FocusSession[];
  restDays: RestDay[];
  proposals: WeeklyProposal[];
  goals: Goal[];
  goalChests: GoalChest[];
  islandPurchases: IslandPurchase[];
  housePurchases: Purchase[];
  roomDecor: RoomDecor[];
  joiaCredit: number;
  tasks: Task[];
  subtasks: TaskSubtask[];
  taskComments: TaskComment[];
  taskEvents: TaskEvent[];
  /** Último número de tarefa dado (nunca volta, mesmo apagando). */
  taskCounter: number;
  mascot: MascotState | null;
}

export function emptyDatabase(): Database {
  return {
    version: 1,
    user: null,
    blocks: [],
    habits: [],
    habitLogs: [],
    sessions: [],
    restDays: [],
    proposals: [],
    goals: [],
    goalChests: [],
    islandPurchases: [],
    housePurchases: [],
    roomDecor: [],
    joiaCredit: 0,
    tasks: [],
    subtasks: [],
    taskComments: [],
    taskEvents: [],
    taskCounter: 0,
    mascot: null,
  };
}

/** Onde o banco mora. `load` devolve uma cópia que o núcleo pode alterar; `commit` grava. */
export interface DatabaseStore {
  load(): Promise<Database>;
  commit(db: Database): Promise<void>;
}

const clone = <T>(value: T): T => (value === null || value === undefined ? value : JSON.parse(JSON.stringify(value)));

function inRange(date: DateKey, range?: DateRange): boolean {
  return !range || (date >= range.from && date <= range.to);
}

function upsert<T>(list: T[], item: T, same: (a: T) => boolean): void {
  const i = list.findIndex(same);
  if (i >= 0) list[i] = item;
  else list.push(item);
}

/** O alvo apagado sai do foco; a sessão fica (o mesmo SetNull do banco). */
function unlinkSessions(db: Database, key: LinkKey, id: string): void {
  db.sessions = db.sessions.map((session) => {
    if (session[key] !== id) return session;
    const { [key]: _removed, ...rest } = session;
    return rest;
  });
}

function requireTask(db: Database, taskId: string): void {
  if (!db.tasks.some((task) => task.id === taskId)) throw new Error(`Tarefa ${taskId} não existe.`);
}

/** Implementação única do contrato Repository sobre qualquer DatabaseStore. Escritas são serializadas. */
/** `clock` marca os eventos do histórico das tarefas. */
export function createRepository(store: DatabaseStore, clock: Clock = systemClock): Repository {
  let queue: Promise<unknown> = Promise.resolve();

  function write<T>(fn: (db: Database) => T): Promise<T> {
    const run = queue.then(async () => {
      const db = await store.load();
      const result = fn(db);
      await store.commit(db);
      return result;
    });
    queue = run.catch(() => undefined);
    return run;
  }

  function read<T>(fn: (db: Database) => T): Promise<T> {
    const run = queue.then(async () => clone(fn(await store.load())));
    return run;
  }

  return {
    getUser: () => read((db) => db.user),
    saveUser: (user) => write((db) => void (db.user = clone(user))),

    listBlocks: () => read((db) => db.blocks),
    saveBlock: (block) => write((db) => upsert(db.blocks, clone(block), (b) => b.id === block.id)),
    deleteBlock: (id) => write((db) => void (db.blocks = db.blocks.filter((b) => b.id !== id))),

    listHabits: () => read((db) => db.habits),
    saveHabit: (habit) => write((db) => upsert(db.habits, clone(habit), (h) => h.id === habit.id)),
    deleteHabit: (id) =>
      write((db) => {
        db.habits = db.habits.filter((h) => h.id !== id);
        db.habitLogs = db.habitLogs.filter((l) => l.habitId !== id);
        unlinkSessions(db, 'habitId', id);
      }),
    listHabitLogs: (range) => read((db) => db.habitLogs.filter((l) => inRange(l.date, range))),
    saveHabitLog: (log) =>
      write((db) => upsert(db.habitLogs, clone(log), (l) => l.habitId === log.habitId && l.date === log.date)),
    deleteHabitLog: (habitId, date) =>
      write((db) => void (db.habitLogs = db.habitLogs.filter((l) => !(l.habitId === habitId && l.date === date)))),

    listSessions: () => read((db) => db.sessions),
    saveSession: (session) =>
      write((db) => {
        const existing = db.sessions.find((s) => s.id === session.id);
        if (existing && existing.state !== 'em_andamento') {
          throw new Error(`Sessão ${session.id} já encerrada: sessões encerradas são imutáveis.`);
        }
        upsert(db.sessions, clone(session), (s) => s.id === session.id);
      }),


    listRestDays: () => read((db) => db.restDays),
    saveRestDay: (restDay) => write((db) => upsert(db.restDays, clone(restDay), (r) => r.date === restDay.date)),
    deleteRestDay: (date) => write((db) => void (db.restDays = db.restDays.filter((r) => r.date !== date))),

    listProposals: () => read((db) => db.proposals),
    saveProposal: (proposal) => write((db) => upsert(db.proposals, clone(proposal), (p) => p.id === proposal.id)),

    listGoals: () => read((db) => db.goals),
    saveGoal: (goal) => write((db) => upsert(db.goals, clone(goal), (g) => g.id === goal.id)),
    deleteGoal: (id) =>
      write((db) => {
        db.goals = db.goals.filter((g) => g.id !== id);
        db.goalChests = db.goalChests.filter((b) => b.goalId !== id);
        db.habits = db.habits.map((habit) => {
          if (habit.goalId !== id) return habit;
          const { goalId: _goalId, ...rest } = habit;
          return rest;
        });
        unlinkSessions(db, 'goalId', id);
        // A tarefa fica, sem a meta.
        db.tasks = db.tasks.map((task) => {
          if (task.goalId !== id) return task;
          const { goalId: _goalId, ...rest } = task;
          return rest;
        });
      }),

    listGoalChests: () => read((db) => db.goalChests),
    saveGoalChest: (chest) =>
      write((db) => {
        // Uma vez só: o primeiro resgate fica.
        if (db.goalChests.some((b) => b.goalId === chest.goalId)) return;
        db.goalChests.push(clone(chest));
      }),

    listTasks: () => read((db) => db.tasks),
    saveTask: (task) =>
      write((db) => {
        const previous = db.tasks.find((t) => t.id === task.id);
        const number = previous?.number ?? (db.taskCounter += 1);
        const createdAt = previous?.createdAt ?? task.createdAt;
        upsert(db.tasks, { ...clone(task), number, createdAt }, (t) => t.id === task.id);
        const at = clock.now();
        for (const change of taskChanges(previous, task)) {
          db.taskEvents.push({ id: newId(at, 'evento'), taskId: task.id, ...change, createdAt: at });
        }
      }),
    deleteTask: (id) =>
      write((db) => {
        db.tasks = db.tasks.filter((t) => t.id !== id);
        db.subtasks = db.subtasks.filter((s) => s.taskId !== id);
        db.taskComments = db.taskComments.filter((c) => c.taskId !== id);
        db.taskEvents = db.taskEvents.filter((e) => e.taskId !== id);
        unlinkSessions(db, 'taskId', id);
      }),
    listSubtasks: () => read((db) => db.subtasks),
    saveSubtask: (subtask) =>
      write((db) => {
        requireTask(db, subtask.taskId);
        upsert(db.subtasks, clone(subtask), (s) => s.id === subtask.id);
      }),
    deleteSubtask: (taskId, id) =>
      write((db) => void (db.subtasks = db.subtasks.filter((s) => !(s.taskId === taskId && s.id === id)))),
    addTaskComment: (comment) =>
      write((db) => {
        requireTask(db, comment.taskId);
        if (!db.taskComments.some((c) => c.id === comment.id)) db.taskComments.push(clone(comment));
      }),
    listTaskActivity: (taskId) =>
      read((db) => {
        requireTask(db, taskId);
        return {
          events: db.taskEvents.filter((e) => e.taskId === taskId),
          comments: db.taskComments.filter((c) => c.taskId === taskId).sort((a, b) => a.createdAt - b.createdAt),
        };
      }),

    listIslandPurchases: () => read((db) => db.islandPurchases),
    saveIslandPurchase: (purchase) => write((db) => upsert(db.islandPurchases, clone(purchase), (p) => p.item === purchase.item)),

    listHousePurchases: () => read((db) => db.housePurchases),
    saveHousePurchase: (purchase) => write((db) => upsert(db.housePurchases, clone(purchase), (p) => p.item === purchase.item)),
    listRoomDecor: () => read((db) => db.roomDecor),
    saveRoomDecor: (decor) => write((db) => upsert(db.roomDecor, clone(decor), (d) => d.item === decor.item)),
    moveRoomDecor: (item, spot) =>
      write((db) => void (db.roomDecor = db.roomDecor.map((d) => (d.item === item ? { ...d, ...spot } : d)))),
    getJoiaCredit: () => read((db) => db.joiaCredit),

    getMascotState: () => read((db) => db.mascot),
    saveMascotState: (state) => write((db) => void (db.mascot = clone(state))),

    clearAll: () => write((db) => void Object.assign(db, emptyDatabase())),
  };
}

export { clone };
