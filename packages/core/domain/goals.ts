import { DEFAULT_TIMEZONE, GOALS, JOIAS } from '../config/decisions';
import { MINUTE_MS } from './clock';
import { dateKeyOf, diffDays } from './day';
import { newId } from './ids';
import { focusedMs } from './joias';
import { fail, ok, type Result } from './result';
import type { AccentColor, DateKey, EntityId, FocusSession, Goal, GoalChest, GoalMilestone, Habit, HabitLog, Repository } from './types';

export type GoalErrorCode =
  | 'titulo_vazio'
  | 'limite_de_metas'
  | 'limite_de_marcos'
  | 'meta_inexistente'
  | 'marco_inexistente'
  | 'prazo_no_passado'
  | 'icone_invalido'
  | 'meta_nao_concluida'
  | 'bau_ja_aberto';

export interface GoalInput {
  title: string;
  why?: string;
  targetDate?: DateKey;
  /** Títulos dos marcos iniciais (vazios são ignorados). */
  milestones?: string[];
  /** Emoji curto. Na edição, omitido (ou vazio) mantém o atual. */
  icon?: string;
  /** Na edição, omitida mantém a atual. */
  color?: AccentColor;
}

export interface GoalProgress {
  done: number;
  total: number;
  /** 0 a 1. Sem marcos, 0 (ou 1 se a meta foi concluída). */
  ratio: number;
}

const LIMITE_DE_METAS = `Até ${GOALS.maxActive} metas ativas de cada vez. Conclua ou apague uma para abrir espaço.`;
const LIMITE_DE_MARCOS = `Uma meta comporta até ${GOALS.maxMilestones} marcos.`;

const activeCount = (goals: readonly Goal[], exceptId?: EntityId) =>
  goals.filter((g) => g.state === 'ativa' && g.id !== exceptId).length;

const cleanText = (value: string | undefined) => value?.trim() || undefined;

function withOptional(goal: Goal, why: string | undefined, targetDate: DateKey | undefined): Goal {
  const { why: _why, targetDate: _target, ...rest } = goal;
  return { ...rest, ...(why ? { why } : {}), ...(targetDate ? { targetDate } : {}) };
}

function checkTarget(targetDate: DateKey | undefined, today: DateKey): Result<DateKey | undefined, GoalErrorCode> {
  if (targetDate && diffDays(targetDate, today) < 0) return fail('prazo_no_passado', 'O prazo precisa ser hoje ou depois.');
  return ok(targetDate);
}

function checkLook(icon: string | undefined, color: AccentColor | undefined): Result<Pick<Goal, 'icon' | 'color'>, GoalErrorCode> {
  const clean = cleanText(icon);
  if (clean && (clean.length > GOALS.iconMaxChars || /\s/.test(clean))) return fail('icone_invalido', 'O ícone é um emoji só.');
  return ok({ ...(clean ? { icon: clean } : {}), ...(color ? { color } : {}) });
}

async function findGoal(repo: Repository, id: EntityId): Promise<Result<Goal, GoalErrorCode>> {
  const goal = (await repo.listGoals()).find((g) => g.id === id);
  return goal ? ok(goal) : fail('meta_inexistente', 'Essa meta não existe mais.');
}

/** Progresso pelos marcos riscados. */
export function goalProgress(goal: Goal): GoalProgress {
  const total = goal.milestones.length;
  const done = goal.milestones.filter((m) => m.doneAt !== undefined).length;
  if (total === 0) return { done, total, ratio: goal.state === 'concluida' ? 1 : 0 };
  return { done, total, ratio: done / total };
}

/** Dias até o prazo (negativo se passou), ou null sem prazo. */
export function daysUntilTarget(goal: Goal, today: DateKey): number | null {
  return goal.targetDate ? diffDays(goal.targetDate, today) : null;
}

export type PaceState = 'no-ritmo' | 'atras' | 'concluida' | 'sem-data';

export interface GoalPace {
  /** Quanto já devia estar feito hoje, de 0 a 1 (a linha de ritmo na barra). Sem data alvo, 0. */
  esperado: number;
  /** Quanto está feito, de 0 a 1 (marcos riscados). */
  atual: number;
  estado: PaceState;
}

const entre0e1 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Ritmo da meta: marcos feitos contra o tempo passado entre a criação e a data alvo.
 * Está no ritmo com até `GOALS.paceTolerance` abaixo do esperado; depois da data, sem terminar, está atrás.
 */
export function ritmo(meta: Goal, hoje: DateKey, timeZone: string = DEFAULT_TIMEZONE): GoalPace {
  const atual = goalProgress(meta).ratio;
  if (meta.state === 'concluida') return { esperado: 1, atual, estado: 'concluida' };
  if (!meta.targetDate) return { esperado: 0, atual, estado: 'sem-data' };
  const inicio = dateKeyOf(meta.createdAt, timeZone);
  const prazo = diffDays(meta.targetDate, inicio);
  const esperado = diffDays(hoje, meta.targetDate) >= 0 ? 1 : entre0e1(diffDays(hoje, inicio) / prazo);
  const vencida = diffDays(hoje, meta.targetDate) > 0 && atual < 1;
  const noRitmo = !vencida && atual + GOALS.paceTolerance >= esperado;
  return { esperado, atual, estado: noRitmo ? 'no-ritmo' : 'atras' };
}

/** Sessão de foco com o vínculo opcional que a spec 19 grava (`goalId` direto ou `habitId`). */
export interface LinkedSession extends FocusSession {
  goalId?: EntityId;
  habitId?: EntityId;
}

export interface GoalRecords {
  habits: readonly Habit[];
  habitLogs: readonly HabitLog[];
  sessions: readonly LinkedSession[];
}

export interface GoalNumbers {
  /** Hábitos atrelados à meta. */
  habitos: Habit[];
  /** Vezes que os hábitos atrelados foram feitos, em todo o histórico recebido. */
  habitosFeitos: number;
  /** Minutos inteiros de foco: sessões ligadas à meta direto ou por um hábito atrelado, cada uma contada uma vez. */
  minutosDeFoco: number;
  /** Dias até a data alvo (negativo se passou), ou null sem data. */
  diasRestantes: number | null;
}

/** Os números da meta, a partir dos registros. Função pura. */
export function numerosDaMeta(meta: Goal, registros: GoalRecords, hoje: DateKey): GoalNumbers {
  const habitos = registros.habits.filter((h) => h.goalId === meta.id);
  const ids = new Set(habitos.map((h) => h.id));
  // O vínculo direto vence: sessão ligada a outra meta não conta aqui pelo hábito.
  const daMeta = (s: LinkedSession) => (s.goalId !== undefined ? s.goalId === meta.id : s.habitId !== undefined && ids.has(s.habitId));
  const ms = registros.sessions.filter(daMeta).reduce((total, s) => total + focusedMs(s), 0);
  return {
    habitos,
    habitosFeitos: registros.habitLogs.filter((log) => ids.has(log.habitId)).length,
    minutosDeFoco: Math.floor(ms / MINUTE_MS),
    diasRestantes: daysUntilTarget(meta, hoje),
  };
}

/** `nenhum`: meta em andamento (o baú aparece fechado); `fechado`: concluída e esperando; `aberto`: já resgatado. */
export type ChestState = 'nenhum' | 'fechado' | 'aberto';

export function estadoDoBau(meta: Goal, baus: readonly GoalChest[]): ChestState {
  if (baus.some((b) => b.goalId === meta.id)) return 'aberto';
  return meta.state === 'concluida' ? 'fechado' : 'nenhum';
}

/** Abre o baú de uma meta concluída, uma vez só: a partir daí as joias contam no saldo. */
export async function abrirBau(repo: Repository, goalId: EntityId, now: number): Promise<Result<GoalChest, GoalErrorCode>> {
  const found = await findGoal(repo, goalId);
  if (!found.ok) return found;
  const estado = estadoDoBau(found.value, await repo.listGoalChests());
  if (estado === 'aberto') return fail('bau_ja_aberto', 'Esse baú já foi aberto.');
  if (estado === 'nenhum') return fail('meta_nao_concluida', 'Conclua a meta para abrir o baú.');
  await repo.saveGoalChest({ goalId, abertoEm: now, joias: JOIAS.por.goalCompleted });
  const saved = (await repo.listGoalChests()).find((b) => b.goalId === goalId);
  return saved ? ok(saved) : fail('meta_inexistente', 'Essa meta não existe mais.');
}

/** Ativas primeiro (prazo mais perto antes, sem prazo por último), depois concluídas da mais recente. */
export function sortGoals(goals: readonly Goal[]): Goal[] {
  const active = goals
    .filter((g) => g.state === 'ativa')
    .sort((a, b) => (a.targetDate ?? '9999-12-31').localeCompare(b.targetDate ?? '9999-12-31') || a.createdAt - b.createdAt);
  const done = goals.filter((g) => g.state === 'concluida').sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  return [...active, ...done];
}

export async function criarMeta(
  repo: Repository,
  input: GoalInput,
  now: number,
  today: DateKey,
): Promise<Result<Goal, GoalErrorCode>> {
  const title = input.title.trim();
  if (!title) return fail('titulo_vazio', 'Dê um nome à meta.');
  const goals = await repo.listGoals();
  if (activeCount(goals) >= GOALS.maxActive) return fail('limite_de_metas', LIMITE_DE_METAS);
  const target = checkTarget(input.targetDate, today);
  if (!target.ok) return target;
  const look = checkLook(input.icon, input.color);
  if (!look.ok) return look;
  const titles = (input.milestones ?? []).map((t) => t.trim()).filter(Boolean);
  if (titles.length > GOALS.maxMilestones) return fail('limite_de_marcos', LIMITE_DE_MARCOS);

  const milestones: GoalMilestone[] = titles.map((t) => ({ id: newId(now, 'marco'), title: t }));
  const base: Goal = { id: newId(now, 'meta'), title, state: 'ativa', milestones, createdAt: now, ...look.value };
  const goal = withOptional(base, cleanText(input.why), target.value);
  await repo.saveGoal(goal);
  return ok(goal);
}

export async function editarMeta(
  repo: Repository,
  id: EntityId,
  patch: Pick<GoalInput, 'title' | 'why' | 'targetDate' | 'icon' | 'color'>,
  today: DateKey,
): Promise<Result<Goal, GoalErrorCode>> {
  const found = await findGoal(repo, id);
  if (!found.ok) return found;
  const title = patch.title.trim();
  if (!title) return fail('titulo_vazio', 'Dê um nome à meta.');
  const keepsTarget = patch.targetDate === found.value.targetDate;
  const target = keepsTarget ? ok(patch.targetDate) : checkTarget(patch.targetDate, today);
  if (!target.ok) return target;
  const look = checkLook(patch.icon, patch.color);
  if (!look.ok) return look;
  const goal = withOptional({ ...found.value, title, ...look.value }, cleanText(patch.why), target.value);
  await repo.saveGoal(goal);
  return ok(goal);
}

export async function adicionarMarco(
  repo: Repository,
  goalId: EntityId,
  title: string,
  now: number,
): Promise<Result<Goal, GoalErrorCode>> {
  const found = await findGoal(repo, goalId);
  if (!found.ok) return found;
  const clean = title.trim();
  if (!clean) return fail('titulo_vazio', 'Dê um nome ao marco.');
  if (found.value.milestones.length >= GOALS.maxMilestones) return fail('limite_de_marcos', LIMITE_DE_MARCOS);
  const goal: Goal = { ...found.value, milestones: [...found.value.milestones, { id: newId(now, 'marco'), title: clean }] };
  await repo.saveGoal(goal);
  return ok(goal);
}

/** Risca ou desrisca um marco. */
export async function alternarMarco(
  repo: Repository,
  goalId: EntityId,
  milestoneId: EntityId,
  now: number,
): Promise<Result<Goal, GoalErrorCode>> {
  const found = await findGoal(repo, goalId);
  if (!found.ok) return found;
  if (!found.value.milestones.some((m) => m.id === milestoneId)) return fail('marco_inexistente', 'Esse marco não existe mais.');
  const milestones = found.value.milestones.map((m) => {
    if (m.id !== milestoneId) return m;
    if (m.doneAt === undefined) return { ...m, doneAt: now };
    const { doneAt: _doneAt, ...open } = m;
    return open;
  });
  const goal: Goal = { ...found.value, milestones };
  await repo.saveGoal(goal);
  return ok(goal);
}

export async function removerMarco(repo: Repository, goalId: EntityId, milestoneId: EntityId): Promise<Result<Goal, GoalErrorCode>> {
  const found = await findGoal(repo, goalId);
  if (!found.ok) return found;
  const goal: Goal = { ...found.value, milestones: found.value.milestones.filter((m) => m.id !== milestoneId) };
  await repo.saveGoal(goal);
  return ok(goal);
}

export async function concluirMeta(repo: Repository, id: EntityId, now: number): Promise<Result<Goal, GoalErrorCode>> {
  const found = await findGoal(repo, id);
  if (!found.ok) return found;
  const goal: Goal = { ...found.value, state: 'concluida', completedAt: now };
  await repo.saveGoal(goal);
  return ok(goal);
}

/** Volta uma meta concluída para as ativas (respeita o limite de ativas). */
export async function reabrirMeta(repo: Repository, id: EntityId): Promise<Result<Goal, GoalErrorCode>> {
  const goals = await repo.listGoals();
  const found = goals.find((g) => g.id === id);
  if (!found) return fail('meta_inexistente', 'Essa meta não existe mais.');
  if (activeCount(goals, id) >= GOALS.maxActive) return fail('limite_de_metas', LIMITE_DE_METAS);
  const { completedAt: _completedAt, ...rest } = found;
  const goal: Goal = { ...rest, state: 'ativa' };
  await repo.saveGoal(goal);
  return ok(goal);
}

export async function apagarMeta(repo: Repository, id: EntityId): Promise<void> {
  await repo.deleteGoal(id);
}
