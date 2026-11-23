import { GOALS } from '../config/decisions';
import { diffDays } from './day';
import { newId } from './ids';
import { fail, ok, type Result } from './result';
import type { DateKey, EntityId, Goal, GoalMilestone, Repository } from './types';

export type GoalErrorCode =
  | 'titulo_vazio'
  | 'limite_de_metas'
  | 'limite_de_marcos'
  | 'meta_inexistente'
  | 'marco_inexistente'
  | 'prazo_no_passado';

export interface GoalInput {
  title: string;
  why?: string;
  targetDate?: DateKey;
  /** Títulos dos marcos iniciais (vazios são ignorados). */
  milestones?: string[];
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
  const titles = (input.milestones ?? []).map((t) => t.trim()).filter(Boolean);
  if (titles.length > GOALS.maxMilestones) return fail('limite_de_marcos', LIMITE_DE_MARCOS);

  const milestones: GoalMilestone[] = titles.map((t) => ({ id: newId(now, 'marco'), title: t }));
  const base: Goal = { id: newId(now, 'meta'), title, state: 'ativa', milestones, createdAt: now };
  const goal = withOptional(base, cleanText(input.why), target.value);
  await repo.saveGoal(goal);
  return ok(goal);
}

export async function editarMeta(
  repo: Repository,
  id: EntityId,
  patch: Pick<GoalInput, 'title' | 'why' | 'targetDate'>,
  today: DateKey,
): Promise<Result<Goal, GoalErrorCode>> {
  const found = await findGoal(repo, id);
  if (!found.ok) return found;
  const title = patch.title.trim();
  if (!title) return fail('titulo_vazio', 'Dê um nome à meta.');
  const keepsTarget = patch.targetDate === found.value.targetDate;
  const target = keepsTarget ? ok(patch.targetDate) : checkTarget(patch.targetDate, today);
  if (!target.ok) return target;
  const goal = withOptional({ ...found.value, title }, cleanText(patch.why), target.value);
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
