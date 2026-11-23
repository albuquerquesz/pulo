import { WEEKLY_AI } from '../config/decisions';
import { acceptProposal, denyProposal, editProposal, undoDecision, type UndoToken } from '../domain/ia/approval';
import { blockSlot, slotOverlaps } from '../domain/ia/candidates';
import type { BlockSlot, ProposalChange, RoutineBlock, WeeklyProposal } from '../domain/types';
import { PROPOSAL_UNDO_GRACE_MS, checkProposalTransition } from './proposal-state';
import type { ProposalDecisionBody } from './schemas';

/** Motivos de recusa de uma decisão (códigos de `docs/api.md`). */
export type DecisionFailureCode =
  | 'corpo_invalido'
  | 'bloco_mudou'
  | 'horario_ocupado'
  | 'proposta_transicao_invalida'
  | 'proposta_imutavel';

export interface DecisionFailure {
  code: DecisionFailureCode;
  message: string;
}

/** Um bloco a gravar. `expected` é o horário que ele precisa ter AGORA no banco (guarda contra bloco que mudou). */
export interface BlockWrite {
  block: RoutineBlock;
  expected: BlockSlot;
}

export type DecisionResult =
  | {
      ok: true;
      /** A proposta depois da decisão (igual à atual quando a decisão é uma repetição). */
      proposal: WeeklyProposal;
      /** Todos os blocos da pessoa depois da decisão. */
      blocks: RoutineBlock[];
      /** Blocos a gravar, junto com a proposta, numa única transação. Vazio em negar e em repetição. */
      writes: BlockWrite[];
      /** `false` quando a decisão repete a que já valia (idempotente): nada é gravado. */
      changed: boolean;
    }
  | { ok: false; failure: DecisionFailure };

const fail = (code: DecisionFailureCode, message: string): DecisionResult => ({ ok: false, failure: { code, message } });

const sameSlot = (a: BlockSlot, b: BlockSlot) =>
  a.weekday === b.weekday && a.startMinutes === b.startMinutes && a.durationMinutes === b.durationMinutes;

const sameChange = (a: ProposalChange, b: ProposalChange) =>
  a.kind === b.kind && a.blockId === b.blockId && sameSlot(a.from, b.from) && sameSlot(a.to, b.to);

/** Igualdade para a idempotência da máquina de estados (mesmo estado, mesmo conteúdo). */
export function sameProposal(a: WeeklyProposal, b: WeeklyProposal): boolean {
  return (
    a.id === b.id &&
    a.weekStart === b.weekStart &&
    a.state === b.state &&
    a.patternText === b.patternText &&
    a.reasonText === b.reasonText &&
    a.origin === b.origin &&
    a.createdAt === b.createdAt &&
    a.decidedAt === b.decidedAt &&
    a.changes.length === b.changes.length &&
    a.changes.every((change, index) => sameChange(change, b.changes[index]))
  );
}

const MSG_TRANSICAO = 'Esta mudança de estado não é permitida.';
const MSG_MUDOU = 'Seu bloco mudou desde que a ideia foi feita. Atualize a semana para ver uma nova.';
const MSG_OCUPADO = 'Esse horário já está ocupado. Tente outro.';

function transition(current: WeeklyProposal, next: WeeklyProposal, now: number): DecisionFailure | null {
  const problem = checkProposalTransition(current, next, now, sameProposal);
  if (problem === null) return null;
  return {
    code: problem,
    message: problem === 'proposta_imutavel' ? 'Semana, origem e criação da proposta não mudam.' : MSG_TRANSICAO,
  };
}

/** Sem `decidedAt`: é o que "pendente" significa. */
function withoutDecision(proposal: WeeklyProposal, changes: ProposalChange[]): WeeklyProposal {
  const { decidedAt: _decidedAt, ...rest } = proposal;
  return { ...rest, state: 'pendente', changes };
}

function diffWrites(before: RoutineBlock[], after: RoutineBlock[]): BlockWrite[] {
  const old = new Map(before.map((block) => [block.id, block]));
  return after.flatMap((block) => {
    const previous = old.get(block.id);
    return previous && !sameSlot(blockSlot(previous), blockSlot(block)) ? [{ block, expected: blockSlot(previous) }] : [];
  });
}

/** Aceitar e editar: aplica as mudanças com a lógica do core, depois de checar que cada bloco ainda está no `from`. */
function applyDecision(
  current: WeeklyProposal,
  blocks: RoutineBlock[],
  body: Extract<ProposalDecisionBody, { action: 'aceitar' | 'editar' }>,
  now: number,
): DecisionResult {
  const target = body.action === 'aceitar' ? 'aceita' : 'editada';
  let changes = current.changes;
  if (body.action === 'editar') {
    const { index, to } = body.change;
    if (index >= current.changes.length) return fail('corpo_invalido', 'Essa proposta não tem essa mudança.');
    changes = current.changes.map((change, i) => (i === index ? { ...change, to: { ...to } } : change));
  }

  if (current.state !== 'pendente') {
    // Repetir a decisão com o mesmo conteúdo é idempotente; qualquer outra coisa a máquina de estados recusa.
    const failure = transition(current, { ...current, state: target, changes }, now);
    return failure ? { ok: false, failure } : { ok: true, proposal: current, blocks, writes: [], changed: false };
  }

  // O bloco precisa estar ainda no horário "antes" da proposta (outro aparelho pode ter mexido nele).
  for (const change of current.changes) {
    const block = blocks.find((b) => b.id === change.blockId);
    if (!block || !sameSlot(blockSlot(block), change.from)) return fail('bloco_mudou', MSG_MUDOU);
  }

  const result =
    body.action === 'aceitar'
      ? acceptProposal(current, blocks, now)
      : editProposal(current, blocks, body.change.index, body.change.to, now);
  if (!result.ok) {
    switch (result.reason) {
      case 'bloco_inexistente':
        return fail('bloco_mudou', MSG_MUDOU);
      case 'conflito':
        return fail('horario_ocupado', MSG_OCUPADO);
      case 'horario_invalido':
        return fail('corpo_invalido', 'Esse horário não funciona. Tente outro.');
      case 'ja_decidida':
        return fail('proposta_transicao_invalida', MSG_TRANSICAO);
    }
  }
  const failure = transition(current, result.proposal, now);
  if (failure) return { ok: false, failure };
  return { ok: true, proposal: result.proposal, blocks: result.blocks, writes: diffWrites(blocks, result.blocks), changed: true };
}

function denyDecision(current: WeeklyProposal, blocks: RoutineBlock[], now: number): DecisionResult {
  const next = current.state === 'pendente' ? denyProposal(current, now) : { ...current, state: 'negada' as const };
  const failure = transition(current, next, now);
  if (failure) return { ok: false, failure };
  return { ok: true, proposal: next, blocks, writes: [], changed: current.state === 'pendente' };
}

/** Desfazer: dentro da janela (relógio do servidor) a proposta volta a pendente e os blocos voltam ao `from`. */
function undoOf(current: WeeklyProposal, blocks: RoutineBlock[], now: number): DecisionResult {
  const proposalBefore = withoutDecision(current, current.changes);
  const failure = transition(current, proposalBefore, now);
  if (failure) return { ok: false, failure };
  if (current.state === 'pendente') return { ok: true, proposal: current, blocks, writes: [], changed: false };

  let restored = blocks.map((block) => ({ ...block }));
  if (current.state !== 'negada') {
    // Aceita ou editada: os blocos precisam estar onde a decisão os deixou; senão não sobrescreve o que a pessoa fez depois.
    for (const change of current.changes) {
      const index = restored.findIndex((b) => b.id === change.blockId);
      const block = restored[index];
      if (!block || !sameSlot(blockSlot(block), change.to)) return fail('bloco_mudou', MSG_MUDOU);
      if (restored.some((other) => other.id !== block.id && slotOverlaps(change.from, blockSlot(other)))) {
        return fail('horario_ocupado', MSG_OCUPADO);
      }
      restored = restored.map((b, i) => (i === index ? { ...b, ...change.from } : b));
    }
  }
  const token: UndoToken = {
    proposalBefore,
    blocksBefore: restored,
    expiresAt: (current.decidedAt ?? 0) + WEEKLY_AI.undoSeconds * 1000 + PROPOSAL_UNDO_GRACE_MS,
  };
  const undone = undoDecision(token, now);
  if (!undone) return fail('proposta_transicao_invalida', MSG_TRANSICAO);
  return {
    ok: true,
    proposal: undone.proposal,
    blocks: undone.blocks,
    writes: diffWrites(blocks, undone.blocks),
    changed: true,
  };
}

/**
 * Decisão sobre uma proposta, pura (o servidor grava o resultado numa transação). Usa `checkProposalTransition`
 * para a máquina de estados, `acceptProposal`/`editProposal`/`undoDecision` para os blocos e `now` do servidor.
 */
export function decideProposal(
  current: WeeklyProposal,
  blocks: RoutineBlock[],
  body: ProposalDecisionBody,
  now: number,
): DecisionResult {
  switch (body.action) {
    case 'aceitar':
    case 'editar':
      return applyDecision(current, blocks, body, now);
    case 'negar':
      return denyDecision(current, blocks, now);
    case 'desfazer':
      return undoOf(current, blocks, now);
  }
}
