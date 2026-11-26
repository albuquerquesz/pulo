import {
  BLOCK_MAX_MINUTES,
  BLOCK_MIN_MINUTES,
  FOCUS,
  WEEKLY_AI,
} from '../config/decisions';
import { supportsBatch } from '../data/batch';
import { newId } from './ids';
import { fail, ok, type Result } from './result';
import type { DateKey, EntityId, Habit, Repository, RoutineBlock, Weekday } from './types';

export type RoutineErrorCode =
  | 'duracao_invalida'
  | 'horario_invalido'
  | 'dia_invalido'
  | 'sobreposicao'
  | 'bloco_inexistente'
  | 'nao_encurta'
  | 'desfazer_expirado';

export interface RoutineError {
  code: RoutineErrorCode;
  message: string;
  /** Em caso de sobreposição: próximo início livre (minutos), se houver. */
  suggestedStartMinutes?: number;
}
export type RoutineResult<T> = { ok: true; value: T } | { ok: false; error: RoutineError };

const MINUTES_PER_DAY = 24 * 60;

export interface BlockInput {
  weekday: Weekday;
  startMinutes: number;
  durationMinutes: number;
  kind: RoutineBlock['kind'];
  title?: string;
  /** Na edição, `undefined` mantém e `null` tira. */
  icon?: string | null;
}

/** Blocos de um dia da semana, em ordem de horário. */
export function blocksForWeekday(blocks: readonly RoutineBlock[], weekday: Weekday): RoutineBlock[] {
  return blocks.filter((b) => b.weekday === weekday).sort((a, b) => a.startMinutes - b.startMinutes);
}

function overlaps(aStart: number, aDur: number, bStart: number, bDur: number): boolean {
  return aStart < bStart + bDur && bStart < aStart + aDur;
}

/** Primeiro início >= `from` em que cabe `duration` minutos sem sobrepor outro bloco. null se não couber no dia. */
export function nextFreeStart(
  blocks: readonly RoutineBlock[],
  weekday: Weekday,
  duration: number,
  from: number,
  ignoreId?: EntityId,
): number | null {
  let start = from;
  for (const b of blocksForWeekday(blocks, weekday)) {
    if (b.id === ignoreId) continue;
    if (overlaps(start, duration, b.startMinutes, b.durationMinutes)) start = b.startMinutes + b.durationMinutes;
  }
  return start + duration <= MINUTES_PER_DAY ? start : null;
}

function validateSlot(
  slot: Pick<RoutineBlock, 'weekday' | 'startMinutes' | 'durationMinutes'>,
  all: readonly RoutineBlock[],
  ignoreId?: EntityId,
): RoutineError | null {
  const { weekday, startMinutes, durationMinutes } = slot;
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return { code: 'dia_invalido', message: 'Dia da semana inválido.' };
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < BLOCK_MIN_MINUTES || durationMinutes > BLOCK_MAX_MINUTES) {
    return {
      code: 'duracao_invalida',
      message: `A duração vai de ${BLOCK_MIN_MINUTES} a ${BLOCK_MAX_MINUTES} minutos.`,
    };
  }
  if (!Number.isInteger(startMinutes) || startMinutes < 0 || startMinutes + durationMinutes > MINUTES_PER_DAY) {
    return { code: 'horario_invalido', message: 'O bloco precisa caber dentro do dia.' };
  }
  const clash = all.some(
    (b) => b.id !== ignoreId && b.weekday === weekday && overlaps(startMinutes, durationMinutes, b.startMinutes, b.durationMinutes),
  );
  if (clash) {
    const suggestion = nextFreeStart(all, weekday, durationMinutes, startMinutes, ignoreId);
    return {
      code: 'sobreposicao',
      message: 'Já existe um bloco nesse horário. Que tal começar um pouco depois?',
      ...(suggestion !== null ? { suggestedStartMinutes: suggestion } : {}),
    };
  }
  return null;
}

export async function criarBloco(repo: Repository, input: BlockInput, now: number): Promise<RoutineResult<RoutineBlock>> {
  const all = await repo.listBlocks();
  const error = validateSlot(input, all);
  if (error) return { ok: false, error };
  const { icon, ...rest } = input;
  const block: RoutineBlock = { id: newId(now, 'bloco'), ...rest, ...(icon ? { icon } : {}) };
  if (!block.title) delete block.title;
  await repo.saveBlock(block);
  return ok(block);
}

export async function editarBloco(
  repo: Repository,
  id: EntityId,
  patch: Partial<BlockInput>,
): Promise<RoutineResult<RoutineBlock>> {
  const all = await repo.listBlocks();
  const current = all.find((b) => b.id === id);
  if (!current) return { ok: false, error: { code: 'bloco_inexistente', message: 'Bloco não encontrado.' } };
  const { icon, ...rest } = patch;
  const next: RoutineBlock = { ...current, ...rest, id };
  if (icon !== undefined) next.icon = icon ?? undefined;
  if (!next.icon) delete next.icon;
  const error = validateSlot(next, all, id);
  if (error) return { ok: false, error };
  await repo.saveBlock(next);
  return ok(next);
}

/** Remove só o agendamento: sessões já feitas ficam (sessões são imutáveis). */
export async function removerBloco(repo: Repository, id: EntityId): Promise<void> {
  await repo.deleteBlock(id);
}

/** Token para desfazer: guarda o bloco anterior e até quando vale. */
export interface UndoToken {
  previous: RoutineBlock;
  expiresAt: number;
}

export interface BlockChange {
  block: RoutineBlock;
  undo: UndoToken;
}

async function applyChange(
  repo: Repository,
  id: EntityId,
  now: number,
  change: (current: RoutineBlock) => RoutineBlock | RoutineError,
): Promise<RoutineResult<BlockChange>> {
  const all = await repo.listBlocks();
  const current = all.find((b) => b.id === id);
  if (!current) return { ok: false, error: { code: 'bloco_inexistente', message: 'Bloco não encontrado.' } };
  const next = change(current);
  if ('code' in next) return { ok: false, error: next };
  const error = validateSlot(next, all, id);
  if (error) return { ok: false, error };
  await repo.saveBlock(next);
  return ok({ block: next, undo: { previous: { ...current }, expiresAt: now + WEEKLY_AI.undoSeconds * 1000 } });
}

/** Move um bloco para outro dia e horário. Devolve o bloco novo e o token de desfazer. */
export function moverBloco(
  repo: Repository,
  id: EntityId,
  novoDia: Weekday,
  novoInicio: number,
  now: number,
): Promise<RoutineResult<BlockChange>> {
  return applyChange(repo, id, now, (b) => ({ ...b, weekday: novoDia, startMinutes: novoInicio }));
}

/** Encurta um bloco (a nova duração precisa ser menor que a atual). */
export function encurtarBloco(
  repo: Repository,
  id: EntityId,
  novaDuracao: number,
  now: number,
): Promise<RoutineResult<BlockChange>> {
  return applyChange(repo, id, now, (b) =>
    novaDuracao >= b.durationMinutes
      ? { code: 'nao_encurta', message: 'A nova duração precisa ser menor que a atual.' }
      : { ...b, durationMinutes: novaDuracao },
  );
}

/** Desfaz mover ou encurtar, dentro da janela. Restaura o bloco anterior. */
export async function desfazerBloco(repo: Repository, undo: UndoToken, now: number): Promise<RoutineResult<RoutineBlock>> {
  if (now > undo.expiresAt) {
    return { ok: false, error: { code: 'desfazer_expirado', message: 'O tempo para desfazer passou.' } };
  }
  await repo.saveBlock(undo.previous);
  return ok(undo.previous);
}

/** Registra o dia de descanso, sem justificativa. Idempotente. */
export async function registrarDescanso(repo: Repository, date: DateKey): Promise<void> {
  await repo.saveRestDay({ date });
}

/** Marca um bloco como feito. Bloco de descanso cria o RestDay; bloco de foco não faz nada aqui (vem da sessão). */
export async function concluirBloco(
  repo: Repository,
  id: EntityId,
  date: DateKey,
): Promise<RoutineResult<{ restDayCreated: boolean }>> {
  const block = (await repo.listBlocks()).find((b) => b.id === id);
  if (!block) return { ok: false, error: { code: 'bloco_inexistente', message: 'Bloco não encontrado.' } };
  if (block.kind === 'descanso') {
    await registrarDescanso(repo, date);
    return ok({ restDayCreated: true });
  }
  return ok({ restDayCreated: false });
}

const SAMPLE_START_MINUTES = [9 * 60, 14 * 60, 19 * 60];
const SAMPLE_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4];
const SAMPLE_HABIT_TITLES = ['Beber água', 'Alongar um pouco'];

/** Plano de exemplo do onboarding: 3 blocos de foco por dia útil e 2 hábitos genéricos. Sem gravar. */
export function planoInicial(now: number): { blocks: RoutineBlock[]; habits: Habit[] } {
  const blocks: RoutineBlock[] = [];
  for (const weekday of SAMPLE_WEEKDAYS) {
    for (const startMinutes of SAMPLE_START_MINUTES) {
      blocks.push({
        id: newId(now, 'bloco'),
        weekday,
        startMinutes,
        durationMinutes: FOCUS.defaultMinutes,
        kind: 'foco',
      });
    }
  }
  const habits: Habit[] = SAMPLE_HABIT_TITLES.map((title) => ({
    id: newId(now, 'habito'),
    title,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    state: 'ativo',
  }));
  return { blocks, habits };
}

/**
 * Grava o plano de exemplo sem duplicar: não grava blocos se a pessoa já tiver algum, nem hábito com o título de um que
 * já existe. Devolve só o que gravou. Com repositório em lote (o remoto) são até 2 chamadas em paralelo, blocos e hábitos,
 * cada uma atômica no servidor; senão, os blocos vão em paralelo e os hábitos um a um (o limite por dia é conferido a
 * cada gravação).
 */
export async function criarPlanoInicial(repo: Repository, now: number): Promise<{ blocks: RoutineBlock[]; habits: Habit[] }> {
  const sample = planoInicial(now);
  const [existingBlocks, existingHabits] = await Promise.all([repo.listBlocks(), repo.listHabits()]);
  const existingTitles = new Set(existingHabits.map((h) => h.title));
  const plan = {
    blocks: existingBlocks.length > 0 ? [] : sample.blocks,
    habits: sample.habits.filter((h) => !existingTitles.has(h.title)),
  };
  if (supportsBatch(repo)) {
    await Promise.all([repo.saveBlocks(plan.blocks), repo.saveHabits(plan.habits)]);
    return plan;
  }
  await Promise.all(plan.blocks.map((b) => repo.saveBlock(b)));
  for (const h of plan.habits) await repo.saveHabit(h);
  return plan;
}
