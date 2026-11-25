import { TASKS } from '../config/decisions';
import { weekEndOf } from './day';
import { newId } from './ids';
import { type Result, fail, ok } from './result';
import type {
  DateKey,
  EntityId,
  FocusSession,
  Repository,
  Task,
  TaskActivity,
  TaskComment,
  TaskEvent,
  TaskPriority,
  TaskStatus,
  TaskSubtask,
} from './types';

/** Colunas do quadro, da esquerda para a direita. Fixas nesta versão. */
export const TASK_COLUMNS = ['ideias', 'afazer', 'fazendo', 'feito'] as const satisfies readonly TaskStatus[];

/** Código curto da tarefa; `null` enquanto o repositório não deu o número. */
export function taskCode(task: Pick<Task, 'number'>): string | null {
  return task.number === undefined ? null : `${TASKS.codePrefix}-${task.number}`;
}

// ---------- Ordem ----------

type Ordenavel = { position: number; id: EntityId };

export function byPosition(a: Ordenavel, b: Ordenavel): number {
  return a.position - b.position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Cartões de uma coluna, de cima para baixo. */
export function columnTasks(tasks: readonly Task[], status: TaskStatus): Task[] {
  return tasks.filter((task) => task.status === status).sort(byPosition);
}

/** Posição entre dois vizinhos (`undefined` = ponta da lista). */
export function positionBetween(above: number | undefined, below: number | undefined): number {
  if (above === undefined) return below === undefined ? TASKS.positionStep : below - TASKS.positionStep;
  return below === undefined ? above + TASKS.positionStep : (above + below) / 2;
}

/** Onde pôr um cartão novo ou movido: no topo (+ da coluna) ou no fim (Adicionar). */
export function positionAt(items: readonly Ordenavel[], where: 'topo' | 'fim'): number {
  const sorted = [...items].sort(byPosition);
  return where === 'topo' ? positionBetween(undefined, sorted[0]?.position) : positionBetween(sorted.at(-1)?.position, undefined);
}

// ---------- Prazo e progresso ----------

/** Valor de prazo para "esta semana": o domingo da semana de `today`. */
export function endOfWeekDue(today: DateKey): DateKey {
  return weekEndOf(today);
}

export type DueFilter = 'hoje' | 'semana';

/** Filtro do quadro. Prazo vencido também aparece (continua sendo para agora). */
export function matchesDueFilter(task: Pick<Task, 'dueDate'>, filter: DueFilter, today: DateKey): boolean {
  if (task.dueDate === undefined) return false;
  return task.dueDate <= (filter === 'hoje' ? today : weekEndOf(today));
}

/**
 * Tarefas de hoje (tela Hoje): as abertas com prazo até hoje e as de prazo exatamente hoje já feitas.
 * Ficam na ordem do prazo e depois da posição.
 */
export function todayTasks(tasks: readonly Task[], today: DateKey): Task[] {
  return tasks
    .filter((task) => task.dueDate !== undefined && (task.dueDate === today || (task.dueDate < today && task.status !== 'feito')))
    .sort((a, b) => ((a.dueDate ?? '') < (b.dueDate ?? '') ? -1 : (a.dueDate ?? '') > (b.dueDate ?? '') ? 1 : byPosition(a, b)));
}

export function subtaskProgress(subtasks: readonly TaskSubtask[], taskId: EntityId): { done: number; total: number } {
  const own = subtasks.filter((subtask) => subtask.taskId === taskId);
  return { done: own.filter((subtask) => subtask.done).length, total: own.length };
}

/** O que importa de uma sessão de foco para os pomodoros. */
export type TaskFocus = Pick<FocusSession, 'state' | 'taskId'>;

/** Pomodoros feitos por tarefa (só as que têm algum). Nunca é gravado. */
export function countPomodoros(sessions: readonly TaskFocus[]): Record<EntityId, number> {
  const done: Record<EntityId, number> = {};
  for (const { state, taskId } of sessions) if (state === 'concluida' && taskId !== undefined) done[taskId] = (done[taskId] ?? 0) + 1;
  return done;
}

/** Repositório que já recebe os pomodoros contados (o remoto: o servidor enxerga todo o histórico). */
export interface PomodoroSource {
  getPomodoros(): Promise<Record<EntityId, number>>;
}

export function providesPomodoros(repo: Repository): repo is Repository & PomodoroSource {
  return 'getPomodoros' in repo && typeof repo.getPomodoros === 'function';
}

/** Os pomodoros de um repositório: os do servidor, quando ele os fornece; senão (demo, memória), contados das sessões. */
export async function verPomodoros(repo: Repository): Promise<Record<EntityId, number>> {
  return providesPomodoros(repo) ? repo.getPomodoros() : countPomodoros(await repo.listSessions());
}

/** Pomodoros feitos: sessões concluídas com esta tarefa. Nunca é gravado. */
export function pomodorosDone(sessions: readonly TaskFocus[], taskId: EntityId): number {
  return sessions.filter((session) => session.taskId === taskId && session.state === 'concluida').length;
}

// ---------- Linha do tempo ----------

export type TimelineItem = { type: 'evento'; event: TaskEvent } | { type: 'comentario'; comment: TaskComment };

const instantOf = (item: TimelineItem) => (item.type === 'evento' ? item.event.createdAt : item.comment.createdAt);

/** Eventos e comentários juntos, do mais antigo ao mais novo. */
export function taskTimeline(activity: TaskActivity): TimelineItem[] {
  const items: TimelineItem[] = [
    ...activity.events.map((event): TimelineItem => ({ type: 'evento', event })),
    ...activity.comments.map((comment): TimelineItem => ({ type: 'comentario', comment })),
  ];
  return items.sort((a, b) => instantOf(a) - instantOf(b));
}

/** O que mudou de uma gravação para a outra, na ordem em que entra no histórico. Sem `previous`, é a criação. */
export function taskChanges(previous: Task | undefined, next: Task): Pick<TaskEvent, 'kind' | 'de' | 'para'>[] {
  if (!previous) return [{ kind: 'criada', para: next.status }];
  const fields = [
    { kind: 'status', de: previous.status, para: next.status },
    { kind: 'prioridade', de: previous.priority, para: next.priority },
    { kind: 'prazo', de: previous.dueDate, para: next.dueDate },
  ] as const;
  return fields
    .filter((change) => change.de !== change.para)
    .map(({ kind, de, para }) => ({ kind, ...(de === undefined ? {} : { de }), ...(para === undefined ? {} : { para }) }));
}

// ---------- Casos de uso ----------

export type TaskErrorCode = 'titulo_invalido' | 'tarefa_inexistente' | 'meta_inexistente';
export type TaskResult = Result<Task, TaskErrorCode>;

const semTarefa = () => fail<TaskErrorCode>('tarefa_inexistente', 'Essa tarefa não existe mais.');

export interface NewTask {
  title: string;
  status?: TaskStatus;
  description?: string;
  priority?: TaskPriority;
  dueDate?: DateKey;
  tags?: string[];
  goalId?: EntityId;
  pomodorosEstimated?: number;
}

/** `done` marca o instante em que entrou em Feito e some quando sai. */
function withStatus(task: Task, status: TaskStatus, now: number): Task {
  const { completedAt, ...rest } = task;
  return status === 'feito' ? { ...rest, status, completedAt: completedAt ?? now } : { ...rest, status };
}

/** Devolve a tarefa como ficou guardada (com o número). */
async function saveAndRead(repo: Repository, task: Task): Promise<TaskResult> {
  await repo.saveTask(task);
  const saved = (await repo.listTasks()).find((item) => item.id === task.id);
  return saved ? ok(saved) : semTarefa();
}

export async function criarTarefa(repo: Repository, input: NewTask, now: number, where: 'topo' | 'fim' = 'fim'): Promise<TaskResult> {
  const title = input.title.trim();
  if (!title || title.length > TASKS.titleMaxChars) {
    return fail<TaskErrorCode>('titulo_invalido', `Dê um nome de até ${TASKS.titleMaxChars} letras para a tarefa.`);
  }
  if (input.goalId !== undefined && !(await repo.listGoals()).some((goal) => goal.id === input.goalId)) {
    return fail<TaskErrorCode>('meta_inexistente', 'Essa meta não existe mais.');
  }
  const status = input.status ?? 'afazer';
  const base: Task = {
    id: newId(now, 'tarefa'),
    title,
    status,
    position: positionAt(columnTasks(await repo.listTasks(), status), where),
    priority: input.priority ?? 'normal',
    tags: [...new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean))],
    pomodorosEstimated: input.pomodorosEstimated ?? 0,
    createdAt: now,
    ...(input.description?.trim() ? { description: input.description } : {}),
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    ...(input.goalId ? { goalId: input.goalId } : {}),
  };
  return saveAndRead(repo, withStatus(base, status, now));
}

/** Leva a tarefa para outra coluna (ou outra altura da mesma). Sem `position`, vai para o fim. */
export async function moverTarefa(repo: Repository, id: EntityId, status: TaskStatus, now: number, position?: number): Promise<TaskResult> {
  const tasks = await repo.listTasks();
  const task = tasks.find((item) => item.id === id);
  if (!task) return semTarefa();
  const others = columnTasks(tasks, status).filter((item) => item.id !== id);
  return saveAndRead(repo, withStatus({ ...task, position: position ?? positionAt(others, 'fim') }, status, now));
}
