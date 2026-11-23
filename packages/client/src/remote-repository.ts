import type { ApiErrorCode } from '@pulo/core/api/schemas';
import { systemClock } from '@pulo/core/domain/clock';
import { inRange } from '@pulo/core/domain/day';
import type {
  CheckIn,
  Clock,
  DateKey,
  DateRange,
  EntityId,
  FocusSession,
  Habit,
  HabitLog,
  MascotState,
  Repository,
  RestDay,
  RoutineBlock,
  User,
  WeeklyProposal,
} from '@pulo/core/domain/types';
import { type UserMetadata, applyUserMetadataPatch, metadataPatchFromUser, userFromMetadata } from '@pulo/core/domain/user-metadata';
import { type ApiClient, type ApiOptions, createApiClient, readJson } from './api';
import {
  cloneBlock,
  cloneCheckIn,
  cloneHabit,
  cloneHabitLog,
  cloneMascot,
  cloneProposal,
  cloneRestDay,
  cloneSession,
} from './clone';
import { Collection } from './collection';
import { RemoteError } from './errors';
import { DEFAULT_HISTORY_DAYS, syncRange } from './sync-range';

export interface RemoteRepositoryOptions extends ApiOptions {
  /** Relógio para escolher a janela do sync. Padrão: relógio do sistema. */
  clock?: Clock;
  /** Dias de histórico no sync da abertura (padrão 180, veja `syncRange`). */
  historyDays?: number;
  /** Tentativas extras quando duas escritas colidem no servidor (`conflito_concorrente`). Padrão 2. */
  retries?: number;
}

/** A pessoa logada, como o servidor devolve no sync. */
export interface Account {
  id: EntityId;
  name: string;
  email: string;
  image: string | null;
}

/**
 * `Repository` do core sobre a API. Lê tudo de uma vez no começo (`GET /api/sync`) e responde as leituras pelo cache.
 * Escritas atualizam o cache na hora e vão ao servidor com o `PUT` ou `DELETE` da rota; se falharem, o cache volta
 * ao que era e o erro (`RemoteError`, com texto em português) sobe para a tela.
 */
export interface RemoteRepository extends Repository {
  readonly account: Account;
  /** Lê tudo de novo do servidor e troca o cache (ex.: ao voltar de um tempo sem internet). */
  reload(): Promise<void>;
}

/** Abre o repositório remoto: faz o sync inicial. Falha com `RemoteError` (`sessao` se não há login). */
export async function createRemoteRepository(options: RemoteRepositoryOptions): Promise<RemoteRepository> {
  const repository = new ApiRepository(options);
  await repository.reload();
  return repository;
}

const compareBlocks = (a: RoutineBlock, b: RoutineBlock) => a.weekday - b.weekday || a.startMinutes - b.startMinutes;
const logKey = (habitId: EntityId, date: DateKey) => `${habitId}|${date}`;

class ApiRepository implements RemoteRepository {
  private readonly client: ApiClient;
  private readonly clock: Clock;
  private readonly historyDays: number;
  private readonly retries: number;

  private accountValue: Account = { id: '', name: '', email: '', image: null };
  private metadata: UserMetadata | null = null;
  private mascot: MascotState | null = null;

  private readonly blocks = new Collection<RoutineBlock>((b) => b.id, cloneBlock);
  private readonly habits = new Collection<Habit>((h) => h.id, cloneHabit);
  private readonly habitLogs = new Collection<HabitLog>((l) => logKey(l.habitId, l.date), cloneHabitLog);
  private readonly sessions = new Collection<FocusSession>((s) => s.id, cloneSession);
  private readonly checkIns = new Collection<CheckIn>((c) => c.id, cloneCheckIn);
  private readonly restDays = new Collection<RestDay>((r) => r.date, cloneRestDay);
  private readonly proposals = new Collection<WeeklyProposal>((p) => p.id, cloneProposal);

  /** Uma escrita por chave de cada vez, na ordem em que foram pedidas (escritas em chaves diferentes seguem em paralelo). */
  private readonly locks = new Map<string, Promise<void>>();

  constructor(options: RemoteRepositoryOptions) {
    this.client = createApiClient(options);
    this.clock = options.clock ?? systemClock;
    this.historyDays = options.historyDays ?? DEFAULT_HISTORY_DAYS;
    this.retries = options.retries ?? 2;
  }

  get account(): Account {
    return { ...this.accountValue };
  }

  async reload(): Promise<void> {
    const query = syncRange(this.clock.now(), this.historyDays);
    const data = await readJson(await this.client.api.sync.$get({ query }));
    this.accountValue = { id: data.user.id, name: data.user.name, email: data.user.email, image: data.user.image };
    this.metadata = data.metadata;
    this.mascot = data.mascot;
    this.blocks.replaceAll(data.blocks);
    this.habits.replaceAll(data.habits);
    this.habitLogs.replaceAll(data.habitLogs);
    this.sessions.replaceAll(data.sessions);
    this.checkIns.replaceAll(data.checkIns);
    this.restDays.replaceAll(data.restDays);
    this.proposals.replaceAll(data.proposals);
  }

  // ---------- Escrita com cache otimista ----------

  private serial(lock: string, task: () => Promise<void>): Promise<void> {
    const run = (this.locks.get(lock) ?? Promise.resolve()).then(task);
    const settled = run.then(
      () => undefined,
      () => undefined,
    );
    this.locks.set(lock, settled);
    void settled.then(() => {
      if (this.locks.get(lock) === settled) this.locks.delete(lock);
    });
    return run;
  }

  /** Repete só quando duas escritas colidiram no servidor. */
  private async withRetry<T>(task: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await task();
      } catch (error) {
        const colisao: ApiErrorCode = 'conflito_concorrente';
        if (!(error instanceof RemoteError) || error.code !== colisao || attempt >= this.retries) throw error;
      }
    }
  }

  /**
   * Grava `next` no cache (ou apaga, se `null`), manda `send` ao servidor e desfaz se falhar.
   * O rollback só acontece se ninguém mexeu na mesma chave depois (compara a instância guardada).
   */
  private async write<V>(
    collection: Collection<V>,
    lock: string,
    key: string,
    next: V | null,
    send: () => Promise<void>,
    undoExtra?: () => void,
  ): Promise<void> {
    const previous = collection.peek(key);
    const mine = next === null ? undefined : collection.put(next);
    if (next === null) collection.remove(key);
    try {
      await this.serial(lock, () => this.withRetry(send));
    } catch (error) {
      if (collection.peek(key) === mine) {
        if (previous === undefined) collection.remove(key);
        else collection.restore(key, previous);
        undoExtra?.();
      }
      throw error;
    }
  }

  private mascotFrom(mascot: MascotState | null): void {
    if (mascot) this.mascot = cloneMascot(mascot);
  }

  // ---------- Usuário (metadados da conta) ----------

  async getUser(): Promise<User | null> {
    return this.metadata ? userFromMetadata(this.accountValue.id, this.metadata) : null;
  }

  async saveUser(user: User): Promise<void> {
    const before = this.metadata;
    const patch = metadataPatchFromUser(user);
    // Otimista, com a mesma função que o servidor usa (o `completedAt` real vem na resposta).
    if (before) this.metadata = applyUserMetadataPatch(before, patch, this.clock.now());
    try {
      await this.serial('user', () =>
        this.withRetry(async () => {
          const { metadata } = await readJson(await this.client.api.me.metadata.$patch({ json: patch }));
          this.metadata = metadata;
        }),
      );
    } catch (error) {
      this.metadata = before;
      throw error;
    }
  }

  // ---------- Blocos ----------

  async listBlocks(): Promise<RoutineBlock[]> {
    return this.blocks.values().sort(compareBlocks);
  }

  saveBlock(block: RoutineBlock): Promise<void> {
    return this.write(this.blocks, `block:${block.id}`, block.id, block, async () => {
      await readJson(await this.client.api.blocks[':id'].$put({ param: { id: block.id }, json: block }));
    });
  }

  deleteBlock(id: EntityId): Promise<void> {
    return this.write(this.blocks, `block:${id}`, id, null, async () => {
      await readJson(await this.client.api.blocks[':id'].$delete({ param: { id } }));
    });
  }

  // ---------- Hábitos ----------

  async listHabits(): Promise<Habit[]> {
    return this.habits.values();
  }

  saveHabit(habit: Habit): Promise<void> {
    return this.write(this.habits, `habit:${habit.id}`, habit.id, habit, async () => {
      await readJson(await this.client.api.habits[':id'].$put({ param: { id: habit.id }, json: habit }));
    });
  }

  deleteHabit(id: EntityId): Promise<void> {
    // O servidor apaga os registros do hábito junto; o cache faz o mesmo e devolve se der erro.
    const logs = this.habitLogs.raw().filter((log) => log.habitId === id);
    for (const log of logs) this.habitLogs.remove(logKey(log.habitId, log.date));
    return this.write(
      this.habits,
      `habit:${id}`,
      id,
      null,
      async () => {
        await readJson(await this.client.api.habits[':id'].$delete({ param: { id } }));
      },
      () => {
        for (const log of logs) this.habitLogs.restore(logKey(log.habitId, log.date), log);
      },
    );
  }

  async listHabitLogs(range?: DateRange): Promise<HabitLog[]> {
    return this.habitLogs
      .values()
      .filter((log) => !range || inRange(log.date, range.from, range.to))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  saveHabitLog(log: HabitLog): Promise<void> {
    const { habitId, date } = log;
    return this.write(this.habitLogs, `log:${logKey(habitId, date)}`, logKey(habitId, date), log, async () => {
      await readJson(await this.client.api['habit-logs'][':habitId'][':date'].$put({ param: { habitId, date }, json: log }));
    });
  }

  deleteHabitLog(habitId: EntityId, date: DateKey): Promise<void> {
    return this.write(this.habitLogs, `log:${logKey(habitId, date)}`, logKey(habitId, date), null, async () => {
      await readJson(await this.client.api['habit-logs'][':habitId'][':date'].$delete({ param: { habitId, date } }));
    });
  }

  // ---------- Sessões de foco ----------

  async listSessions(): Promise<FocusSession[]> {
    return this.sessions.values().sort((a, b) => a.startedAt - b.startedAt);
  }

  saveSession(session: FocusSession): Promise<void> {
    return this.write(this.sessions, `session:${session.id}`, session.id, session, async () => {
      const { mascot } = await readJson(await this.client.api.sessions[':id'].$put({ param: { id: session.id }, json: session }));
      this.mascotFrom(mascot);
    });
  }

  // ---------- Check ins ----------

  async listCheckIns(range?: DateRange): Promise<CheckIn[]> {
    return this.checkIns
      .values()
      .filter((c) => !range || inRange(c.date, range.from, range.to))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  saveCheckIn(checkIn: CheckIn): Promise<void> {
    return this.write(this.checkIns, `checkin:${checkIn.id}`, checkIn.id, checkIn, async () => {
      await readJson(await this.client.api['check-ins'][':id'].$put({ param: { id: checkIn.id }, json: checkIn }));
    });
  }

  // ---------- Dias de descanso ----------

  async listRestDays(): Promise<RestDay[]> {
    return this.restDays.values().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  saveRestDay(restDay: RestDay): Promise<void> {
    const { date } = restDay;
    return this.write(this.restDays, `rest:${date}`, date, restDay, async () => {
      const { mascot } = await readJson(await this.client.api['rest-days'][':date'].$put({ param: { date } }));
      this.mascotFrom(mascot);
    });
  }

  deleteRestDay(date: DateKey): Promise<void> {
    return this.write(this.restDays, `rest:${date}`, date, null, async () => {
      const { mascot } = await readJson(await this.client.api['rest-days'][':date'].$delete({ param: { date } }));
      this.mascotFrom(mascot);
    });
  }

  // ---------- Propostas ----------

  async listProposals(): Promise<WeeklyProposal[]> {
    return this.proposals.values().sort((a, b) => (a.weekStart < b.weekStart ? 1 : a.weekStart > b.weekStart ? -1 : 0));
  }

  saveProposal(proposal: WeeklyProposal): Promise<void> {
    return this.write(this.proposals, `proposal:${proposal.id}`, proposal.id, proposal, async () => {
      await readJson(await this.client.api.proposals[':id'].$put({ param: { id: proposal.id }, json: proposal }));
    });
  }

  // ---------- Estado do sapo ----------

  async getMascotState(): Promise<MascotState | null> {
    return this.mascot ? cloneMascot(this.mascot) : null;
  }

  /** O servidor é quem calcula o sapo (ao encerrar sessão e ao mexer em descanso). Aqui só atualiza o cache da sessão. */
  async saveMascotState(state: MascotState): Promise<void> {
    this.mascot = cloneMascot(state);
  }

  // ---------- Apagar tudo ----------

  /** `DELETE /api/data` e depois zera o perfil (a pessoa volta ao onboarding). Sem otimismo: só limpa o cache com o servidor confirmando. */
  async clearAll(): Promise<void> {
    await this.serial('all', () =>
      this.withRetry(async () => {
        await readJson(await this.client.api.data.$delete());
        for (const collection of [this.blocks, this.habits, this.habitLogs, this.sessions, this.checkIns, this.restDays, this.proposals]) {
          collection.clear();
        }
        this.mascot = null;
        const { metadata } = await readJson(
          await this.client.api.me.metadata.$patch({ json: { profile: null, onboardingCompleted: false } }),
        );
        this.metadata = metadata;
      }),
    );
  }
}
