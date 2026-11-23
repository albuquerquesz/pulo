import type {
  DateKey,
  DateRange,
  FocusSession,
  Habit,
  HabitLog,
  MascotState,
  Repository,
  RestDay,
  RoutineBlock,
  User,
  WeeklyProposal,
} from '../domain/types';

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

/** Implementação única do contrato Repository sobre qualquer DatabaseStore. Escritas são serializadas. */
export function createRepository(store: DatabaseStore): Repository {
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

    getMascotState: () => read((db) => db.mascot),
    saveMascotState: (state) => write((db) => void (db.mascot = clone(state))),

    clearAll: () => write((db) => void Object.assign(db, emptyDatabase())),
  };
}

export { clone };
