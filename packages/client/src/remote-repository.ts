import {
  type ApiErrorCode,
  type GenerateProposalBody,
  type GenerateProposalResponse,
  type ProposalDecisionBody,
  type ProposalDecisionResponse,
  generateProposalResponseSchema,
  proposalDecisionResponseSchema,
  type McpConnection,
  mcpConnectionsResponseSchema,
  statsResponseSchema,
  streakResponseSchema,
  taskCommentSchema,
  taskEventSchema,
} from '@pulo/core/api/schemas';
import { ACCOUNT, DEFAULT_TIMEZONE } from '@pulo/core/config/decisions';
import type { BatchWrites } from '@pulo/core/data/batch';
import { systemClock } from '@pulo/core/domain/clock';
import { dateKeyOf, inRange } from '@pulo/core/domain/day';
import type { StatsSource } from '@pulo/core/domain/stats';
import type { StreakSource } from '@pulo/core/domain/streak';
import type {
  Clock,
  DateKey,
  DateRange,
  EntityId,
  FocusSession,
  Goal,
  GoalChest,
  Habit,
  HabitLog,
  IslandPurchase,
  Purchase,
  RoomDecor,
  RoomSpot,
  MascotState,
  Preferences,
  ProfileStats,
  Repository,
  RestDay,
  RoutineBlock,
  Streak,
  Task,
  TaskActivity,
  TaskComment,
  TaskSubtask,
  User,
  WeeklyProposal,
} from '@pulo/core/domain/types';
import {
  DEFAULT_USER_METADATA,
  type PreferencesPatch,
  type UserMetadata,
  type UserMetadataPatch,
  applyUserMetadataPatch,
  metadataPatchFromUser,
  preferencesFromMetadata,
  userFromMetadata,
} from '@pulo/core/domain/user-metadata';
import { z } from 'zod';
import { type ApiClient, type ApiOptions, createApiClient, readJson } from './api';
import {
  cloneBlock,
  cloneGoal,
  cloneGoalChest,
  cloneHabit,
  cloneHabitLog,
  cloneIslandPurchase,
  cloneRoomDecor,
  cloneMascot,
  cloneProposal,
  cloneRestDay,
  cloneSession,
  cloneStreak,
  cloneSubtask,
  cloneTask,
} from './clone';
import { Collection } from './collection';
import { MENSAGENS_DA_API, RemoteError } from './errors';
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
export interface RemoteRepository extends Repository, BatchWrites, StreakSource, StatsSource {
  readonly account: Account;
  /**
   * `POST /api/proposals/generate`: o servidor lê os dados, aplica as regras, consulta a IA (se houver) e guarda a proposta.
   * `date` (qualquer dia da semana) é opcional: o padrão é a semana de agora, pelo relógio do servidor e o fuso da pessoa.
   * `proposta` e `existente` entram no cache de propostas.
   */
  generateProposal(date?: GenerateProposalBody['date']): Promise<GenerateProposalResponse>;
  /**
   * `POST /api/proposals/:id/decision`: aceitar, editar, negar ou desfazer, com os blocos aplicados na mesma transação do servidor.
   * Troca no cache a proposta e os blocos pelo que o servidor devolveu. Se o servidor recusar (ex.: `bloco_mudou`), o cache é relido.
   */
  decideProposal(id: EntityId, decision: ProposalDecisionBody): Promise<ProposalDecisionResponse>;
  /**
   * A sequência calculada pelo servidor (todo o histórico). Vem no sync; depois de uma escrita que pode mudá-la
   * (ou da virada do dia), espera as escritas pendentes e chama `GET /api/streak`. Se a rede falhar, devolve a última.
   */
  getStreak(): Promise<Streak>;
  /** As preferências da conta (vêm no sync). */
  getPreferences(): Promise<Preferences>;
  /** Muda só as preferências enviadas (`PATCH /api/me/metadata`), com cache otimista. */
  savePreferences(patch: PreferencesPatch): Promise<void>;
  /**
   * Os números de todo o tempo (`stats` do sync). Depois de uma escrita que pode mudá-los, chama `GET /api/stats`.
   * Se a rede falhar, devolve os últimos.
   */
  getStats(): Promise<ProfileStats>;
  /** `GET /api/data/export`: todos os dados da conta, prontos para virar um arquivo. Espera as escritas pendentes. */
  exportData(): Promise<Record<string, unknown>>;
  /** Os aplicativos (Claude e outros) com acesso à conta. */
  listConnections(): Promise<McpConnection[]>;
  /** Revoga o acesso de um aplicativo. */
  disconnect(clientId: string): Promise<void>;
  /** `DELETE /api/account`: exclui a conta de vez e limpa o cache. A tela pede a confirmação antes de chamar. */
  deleteAccount(): Promise<void>;
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
const taskActivitySchema = z.object({ events: z.array(taskEventSchema), comments: z.array(taskCommentSchema) });
const logKey = (habitId: EntityId, date: DateKey) => `${habitId}|${date}`;
/** Chaves das escritas que podem mudar a sequência: hábitos e registros, sessões, descansos, perfil e apagar tudo. */
const STREAK_LOCKS = /^(habit|log|session|rest):|^(user|all)$/;

class ApiRepository implements RemoteRepository {
  private readonly client: ApiClient;
  private readonly clock: Clock;
  private readonly historyDays: number;
  private readonly retries: number;

  private accountValue: Account = { id: '', name: '', email: '', image: null };
  private metadata: UserMetadata | null = null;
  private mascot: MascotState | null = null;
  private joiaCredit = 0;
  private streak: Streak | null = null;
  /** Dia (do app) em que a sequência guardada foi lida; `null` quando uma escrita a envelheceu. */
  private streakDay: DateKey | null = null;
  /** Conta as escritas que podem mudar a sequência, para não dar por nova uma leitura que cruzou com elas. */
  private streakVersion = 0;
  private stats: ProfileStats | null = null;
  private statsStale = false;

  private readonly blocks = new Collection<RoutineBlock>((b) => b.id, cloneBlock);
  private readonly habits = new Collection<Habit>((h) => h.id, cloneHabit);
  private readonly habitLogs = new Collection<HabitLog>((l) => logKey(l.habitId, l.date), cloneHabitLog);
  private readonly sessions = new Collection<FocusSession>((s) => s.id, cloneSession);
  private readonly restDays = new Collection<RestDay>((r) => r.date, cloneRestDay);
  private readonly proposals = new Collection<WeeklyProposal>((p) => p.id, cloneProposal);
  private readonly goals = new Collection<Goal>((g) => g.id, cloneGoal);
  private readonly goalChests = new Collection<GoalChest>((b) => b.goalId, cloneGoalChest);
  private readonly islandPurchases = new Collection<IslandPurchase>((p) => p.item, cloneIslandPurchase);

  private readonly housePurchases = new Collection<Purchase>((p) => p.item, cloneIslandPurchase);
  private readonly roomDecor = new Collection<RoomDecor>((d) => d.item, cloneRoomDecor);

  private readonly tasks = new Collection<Task>((t) => t.id, cloneTask);
  private readonly subtasks = new Collection<TaskSubtask>((s) => s.id, cloneSubtask);

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
    this.streak = data.streak;
    this.streakDay = this.today();
    this.stats = data.stats;
    this.statsStale = false;
    this.blocks.replaceAll(data.blocks);
    this.habits.replaceAll(data.habits);
    this.habitLogs.replaceAll(data.habitLogs);
    this.sessions.replaceAll(data.sessions);
    this.restDays.replaceAll(data.restDays);
    this.proposals.replaceAll(data.proposals);
    this.goals.replaceAll(data.goals);
    this.goalChests.replaceAll(data.goalChests);
    this.tasks.replaceAll(data.tasks);
    this.subtasks.replaceAll(data.subtasks);
    this.islandPurchases.replaceAll(data.islandPurchases);
    this.housePurchases.replaceAll(data.housePurchases);
    this.roomDecor.replaceAll(data.roomDecor);
    this.joiaCredit = data.joiaCredit;
  }

  // ---------- Escrita com cache otimista ----------

  private serial(lock: string, task: () => Promise<void>): Promise<void> {
    const run = (this.locks.get(lock) ?? Promise.resolve()).then(task);
    const settle = () => {
      if (STREAK_LOCKS.test(lock)) this.expireStreak();
    };
    const settled = run.then(settle, settle);
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

  /**
   * Como `write`, para vários itens numa só chamada (`PUT /api/blocks` ou `/api/habits`, atômica no servidor).
   * Se falhar, volta cada item ao que era (só os que ninguém mexeu depois).
   */
  private async writeMany<V>(
    collection: Collection<V>,
    lock: string,
    items: readonly V[],
    keyOf: (item: V) => string,
    send: () => Promise<void>,
  ): Promise<void> {
    const entries = items.map((item) => {
      const key = keyOf(item);
      return { key, previous: collection.peek(key), mine: collection.put(item) };
    });
    try {
      await this.serial(lock, () => this.withRetry(send));
    } catch (error) {
      for (const { key, previous, mine } of entries) {
        if (collection.peek(key) !== mine) continue;
        if (previous === undefined) collection.remove(key);
        else collection.restore(key, previous);
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
    await this.patchMetadata(metadataPatchFromUser(user));
  }

  async getPreferences(): Promise<Preferences> {
    return preferencesFromMetadata(this.metadata ?? DEFAULT_USER_METADATA);
  }

  async savePreferences(patch: PreferencesPatch): Promise<void> {
    await this.patchMetadata(patch);
  }

  private async patchMetadata(patch: UserMetadataPatch): Promise<void> {
    const before = this.metadata;
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

  saveBlocks(blocks: readonly RoutineBlock[]): Promise<void> {
    if (blocks.length === 0) return Promise.resolve();
    return this.writeMany(this.blocks, 'blocks:batch', blocks, (b) => b.id, async () => {
      await readJson(await this.client.api.blocks.$put({ json: { blocks: [...blocks] } }));
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

  /**
   * O corpo que o servidor espera: soltar a meta é `goalId: null` (omitido, o servidor mantém a gravada).
   * Calcule antes da escrita otimista, enquanto o cache ainda tem a versão anterior.
   */
  private habitBody(habit: Habit) {
    const released = habit.goalId === undefined && this.habits.peek(habit.id)?.goalId !== undefined;
    return released ? { ...habit, goalId: null } : habit;
  }

  /** A meta nova do hábito precisa ter chegado ao servidor. */
  private async afterGoals(habits: readonly Habit[]): Promise<void> {
    await Promise.all(habits.map((habit) => (habit.goalId === undefined ? undefined : this.locks.get(`goal:${habit.goalId}`))));
  }

  saveHabit(habit: Habit): Promise<void> {
    const body = this.habitBody(habit);
    return this.write(this.habits, `habit:${habit.id}`, habit.id, habit, async () => {
      await this.afterGoals([habit]);
      await readJson(await this.client.api.habits[':id'].$put({ param: { id: habit.id }, json: body }));
    });
  }

  saveHabits(habits: readonly Habit[]): Promise<void> {
    if (habits.length === 0) return Promise.resolve();
    const body = habits.map((habit) => this.habitBody(habit));
    return this.writeMany(this.habits, 'habits:batch', habits, (h) => h.id, async () => {
      await this.afterGoals(habits);
      await readJson(await this.client.api.habits.$put({ json: { habits: body } }));
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

  async generateProposal(date?: GenerateProposalBody['date']): Promise<GenerateProposalResponse> {
    const response = await this.callAndParse(
      'proposal:generate',
      async () => await this.client.api.proposals.generate.$post({ json: date === undefined ? {} : { date } }),
      generateProposalResponseSchema,
    );
    if (response.outcome === 'proposta' || response.outcome === 'existente') this.proposals.put(response.proposal);
    return response;
  }

  async decideProposal(id: EntityId, decision: ProposalDecisionBody): Promise<ProposalDecisionResponse> {
    try {
      const response = await this.callAndParse(
        `proposal:${id}`,
        async () => await this.client.api.proposals[':id'].decision.$post({ param: { id }, json: decision }),
        proposalDecisionResponseSchema,
      );
      this.proposals.put(response.proposal);
      this.blocks.replaceAll(response.blocks);
      return response;
    } catch (error) {
      // O servidor é a verdade: se recusou, o cache pode estar atrás (bloco mexido em outro aparelho). Releia sem esconder o erro.
      if (error instanceof RemoteError && error.kind === 'api') await this.reload().catch(() => undefined);
      throw error;
    }
  }

  /** Uma chamada em série por chave, com repetição em `conflito_concorrente`; a resposta passa pelo schema do contrato. */
  private async callAndParse<S extends z.ZodType>(
    lock: string,
    send: () => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>,
    schema: S,
  ): Promise<z.output<S>> {
    let result: z.output<S> | undefined;
    await this.serial(lock, () =>
      this.withRetry(async () => {
        const raw = await readJson(await send());
        const parsed = schema.safeParse(raw);
        if (!parsed.success) {
          throw new RemoteError({ kind: 'resposta_invalida', mensagem: MENSAGENS_DA_API.erro_interno, cause: parsed.error });
        }
        result = parsed.data;
      }),
    );
    if (result === undefined) throw new RemoteError({ kind: 'resposta_invalida', mensagem: MENSAGENS_DA_API.erro_interno });
    return result;
  }

  // ---------- Metas ----------

  async listGoals(): Promise<Goal[]> {
    return this.goals.values().sort((a, b) => a.createdAt - b.createdAt);
  }

  saveGoal(goal: Goal): Promise<void> {
    return this.write(this.goals, `goal:${goal.id}`, goal.id, goal, async () => {
      await readJson(await this.client.api.goals[':id'].$put({ param: { id: goal.id }, json: goal }));
    });
  }

  deleteGoal(id: EntityId): Promise<void> {
    // O servidor solta o vínculo das tarefas e dos hábitos e apaga o baú; o cache faz o mesmo e devolve se der erro.
    const chest = this.goalChests.peek(id);
    this.goalChests.remove(id);
    const habits = this.habits.raw().filter((habit) => habit.goalId === id);
    const released = habits.map(({ goalId: _goalId, ...habit }) => this.habits.put(habit));
    const linked = this.tasks.raw().filter((task) => task.goalId === id);
    const unlinked = linked.map(({ goalId: _goalId, ...task }) => this.tasks.put(task));
    return this.write(
      this.goals,
      `goal:${id}`,
      id,
      null,
      async () => {
        await readJson(await this.client.api.goals[':id'].$delete({ param: { id } }));
      },
      () => {
        if (chest !== undefined) this.goalChests.restore(id, chest);
        habits.forEach((habit, i) => {
          if (this.habits.peek(habit.id) === released[i]) this.habits.restore(habit.id, habit);
        });
        linked.forEach((task, i) => {
          if (this.tasks.peek(task.id) === unlinked[i]) this.tasks.restore(task.id, task);
        });
      },
    );
  }

  async listGoalChests(): Promise<GoalChest[]> {
    return this.goalChests.values().sort((a, b) => a.abertoEm - b.abertoEm);
  }

  /** Usa a mesma fila da meta, para a conclusão chegar antes. As joias e a hora ficam as do servidor. */
  saveGoalChest(chest: GoalChest): Promise<void> {
    const { goalId } = chest;
    return this.write(this.goalChests, `goal:${goalId}`, goalId, chest, async () => {
      const saved = await readJson(await this.client.api.goals[':id'].chest.$post({ param: { id: goalId } }));
      this.goalChests.put(saved.chest);
    });
  }

  // ---------- Tarefas ----------

  async listTasks(): Promise<Task[]> {
    return this.tasks.values().sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Numa tarefa nova o cartão aparece na hora sem número; o código chega com a resposta.
   * As escritas de uma tarefa (ela, subtarefas e comentários) seguem em ordem.
   */
  saveTask(task: Task): Promise<void> {
    const { id, goalId } = task;
    const previous = this.tasks.peek(id);
    const next: Task = previous ? { ...task, number: previous.number, createdAt: previous.createdAt } : task;
    let stored: Task | undefined;
    const done = this.write(this.tasks, `task:${id}`, id, next, async () => {
      // A meta pode estar sendo criada agora: espera a escrita dela.
      if (goalId !== undefined) await this.locks.get(`goal:${goalId}`);
      const { task: saved } = await readJson(await this.client.api.tasks[':id'].$put({ param: { id }, json: task }));
      // Muda as instâncias guardadas no lugar: o rollback compara identidade.
      const server = { number: saved.number, createdAt: saved.createdAt };
      // A minha cópia (a que um rollback posterior devolve) e a atual.
      for (const cached of [stored, this.tasks.peek(id)]) {
        if (cached) Object.assign(cached, server);
      }
    });
    // `write` já guardou a cópia otimista antes de devolver a promessa.
    stored = this.tasks.peek(id);
    return done;
  }

  deleteTask(id: EntityId): Promise<void> {
    const own = this.subtasks.raw().filter((subtask) => subtask.taskId === id);
    for (const subtask of own) this.subtasks.remove(subtask.id);
    return this.write(
      this.tasks,
      `task:${id}`,
      id,
      null,
      async () => {
        await readJson(await this.client.api.tasks[':id'].$delete({ param: { id } }));
      },
      () => {
        for (const subtask of own) this.subtasks.restore(subtask.id, subtask);
      },
    );
  }

  async listSubtasks(): Promise<TaskSubtask[]> {
    return this.subtasks.values().sort((a, b) => a.position - b.position);
  }

  saveSubtask(subtask: TaskSubtask): Promise<void> {
    const { id, taskId } = subtask;
    return this.write(this.subtasks, `task:${taskId}`, id, subtask, async () => {
      await readJson(await this.client.api.tasks[':id'].subtasks[':subId'].$put({ param: { id: taskId, subId: id }, json: subtask }));
    });
  }

  deleteSubtask(taskId: EntityId, id: EntityId): Promise<void> {
    return this.write(this.subtasks, `task:${taskId}`, id, null, async () => {
      await readJson(await this.client.api.tasks[':id'].subtasks[':subId'].$delete({ param: { id: taskId, subId: id } }));
    });
  }

  /** Comentários e histórico não ficam em cache: são lidos quando a gaveta abre. */
  addTaskComment(comment: TaskComment): Promise<void> {
    const { taskId } = comment;
    return this.serial(`task:${taskId}`, () =>
      this.withRetry(async () => {
        await readJson(await this.client.api.tasks[':id'].comments.$post({ param: { id: taskId }, json: comment }));
      }),
    );
  }

  /** `GET /api/tasks/:id/activity`, depois das escritas pendentes da tarefa. */
  async listTaskActivity(id: EntityId): Promise<TaskActivity> {
    await this.locks.get(`task:${id}`);
    return this.callAndParse(
      `activity:${id}`,
      async () => await this.client.api.tasks[':id'].activity.$get({ param: { id } }),
      taskActivitySchema,
    );
  }

  // ---------- Ilha ----------

  async listIslandPurchases(): Promise<IslandPurchase[]> {
    return this.islandPurchases.values().sort((a, b) => a.createdAt - b.createdAt);
  }

  /** O servidor confere o saldo, a ordem das áreas e o preço; se recusar, a compra sai do cache e o erro sobe. */
  saveIslandPurchase(purchase: IslandPurchase): Promise<void> {
    const { item } = purchase;
    return this.write(this.islandPurchases, `island:${item}`, item, purchase, async () => {
      await readJson(await this.client.api.island.purchases[':item'].$put({ param: { item }, json: purchase }));
    });
  }

  // ---------- Casa e quarto ----------

  async listHousePurchases(): Promise<Purchase[]> {
    return this.housePurchases.values().sort((a, b) => a.createdAt - b.createdAt);
  }

  /** O servidor confere o saldo e o preço; se recusar, a compra sai do cache e o erro sobe. */
  saveHousePurchase(purchase: Purchase): Promise<void> {
    const { item } = purchase;
    return this.write(this.housePurchases, `house:${item}`, item, purchase, async () => {
      await readJson(await this.client.api.house[':item'].$put({ param: { item }, json: purchase }));
    });
  }

  async listRoomDecor(): Promise<RoomDecor[]> {
    return this.roomDecor.values().sort((a, b) => a.createdAt - b.createdAt);
  }

  saveRoomDecor(decor: RoomDecor): Promise<void> {
    const { item } = decor;
    return this.write(this.roomDecor, `room:${item}`, item, decor, async () => {
      await readJson(await this.client.api.room[':item'].$put({ param: { item }, json: decor }));
    });
  }

  async moveRoomDecor(item: string, spot: RoomSpot): Promise<void> {
    const atual = this.roomDecor.peek(item);
    if (!atual) return;
    await this.write(this.roomDecor, `room:${item}`, item, { ...atual, ...spot }, async () => {
      await readJson(await this.client.api.room[':item'].$patch({ param: { item }, json: spot }));
    });
  }

  async getJoiaCredit(): Promise<number> {
    return this.joiaCredit;
  }

  // ---------- Estado do sapo ----------

  async getMascotState(): Promise<MascotState | null> {
    return this.mascot ? cloneMascot(this.mascot) : null;
  }

  /** O servidor é quem calcula o sapo (ao encerrar sessão e ao mexer em descanso). Aqui só atualiza o cache da sessão. */
  async saveMascotState(state: MascotState): Promise<void> {
    this.mascot = cloneMascot(state);
  }

  // ---------- Sequência ----------

  private today(): DateKey {
    return dateKeyOf(this.clock.now(), this.metadata?.timezone ?? DEFAULT_TIMEZONE);
  }

  private expireStreak(): void {
    this.streakVersion += 1;
    this.streakDay = null;
    this.statsStale = true;
  }

  async getStreak(): Promise<Streak> {
    await Promise.all(this.locks.values());
    const day = this.today();
    if (this.streak && this.streakDay === day) return cloneStreak(this.streak);
    const version = this.streakVersion;
    try {
      const raw = await readJson(await this.client.api.streak.$get());
      this.streak = streakResponseSchema.parse(raw).streak;
      if (version === this.streakVersion) this.streakDay = day;
    } catch (error) {
      if (!this.streak) throw error;
    }
    return cloneStreak(this.streak);
  }

  // ---------- Perfil e conta ----------

  async getStats(): Promise<ProfileStats> {
    await Promise.all(this.locks.values());
    if (this.stats && !this.statsStale) return { ...this.stats };
    const version = this.streakVersion;
    try {
      const raw = await readJson(await this.client.api.stats.$get());
      this.stats = statsResponseSchema.parse(raw).stats;
      if (version === this.streakVersion) this.statsStale = false;
    } catch (error) {
      if (!this.stats) throw error;
    }
    return { ...this.stats };
  }

  async exportData(): Promise<Record<string, unknown>> {
    await Promise.all(this.locks.values());
    return readJson(await this.client.api.data.export.$get());
  }

  async listConnections(): Promise<McpConnection[]> {
    const raw = await readJson(await this.client.api.mcp.connections.$get());
    return mcpConnectionsResponseSchema.parse(raw).connections;
  }

  async disconnect(clientId: string): Promise<void> {
    await this.withRetry(async () => {
      await readJson(await this.client.api.mcp.connections[':clientId'].$delete({ param: { clientId } }));
    });
  }

  async deleteAccount(): Promise<void> {
    await this.serial('all', async () => {
      await readJson(await this.client.api.account.$delete({ json: { confirm: ACCOUNT.deleteConfirmation } }));
      this.clearCache();
      this.accountValue = { id: '', name: '', email: '', image: null };
      this.metadata = null;
      this.streak = null;
      this.stats = null;
    });
  }

  private clearCache(): void {
    const collections = [this.blocks, this.habits, this.habitLogs, this.sessions, this.restDays, this.proposals, this.goals, this.goalChests, this.tasks, this.subtasks, this.islandPurchases, this.housePurchases, this.roomDecor];
    for (const collection of collections) {
      collection.clear();
    }
    this.mascot = null;
    this.joiaCredit = 0;
  }

  // ---------- Apagar tudo ----------

  /** `DELETE /api/data` e depois zera o perfil (a pessoa volta ao onboarding). Sem otimismo: só limpa o cache com o servidor confirmando. */
  async clearAll(): Promise<void> {
    await this.serial('all', () =>
      this.withRetry(async () => {
        await readJson(await this.client.api.data.$delete());
        this.clearCache();
        const { metadata } = await readJson(
          await this.client.api.me.metadata.$patch({ json: { profile: null, onboardingCompleted: false } }),
        );
        this.metadata = metadata;
      }),
    );
  }
}
