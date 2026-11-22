import { BLOCK_MAX_MINUTES, BLOCK_MIN_MINUTES, WEEKLY_AI } from '@/config/decisions';
import type { BlockSlot, ProposalChange, RoutineBlock, WeeklyProposal } from '@/domain/types';
import { blockSlot, slotOverlaps } from './candidates';

export interface UndoToken {
  proposalBefore: WeeklyProposal;
  blocksBefore: RoutineBlock[];
  expiresAt: number;
}

export type ApprovalResult =
  | { ok: true; proposal: WeeklyProposal; blocks: RoutineBlock[]; undo: UndoToken }
  | { ok: false; reason: 'ja_decidida' | 'bloco_inexistente' | 'horario_invalido' | 'conflito' };

function validSlot(s: BlockSlot): boolean {
  return (
    s.weekday >= 0 &&
    s.weekday <= 6 &&
    s.startMinutes >= 0 &&
    s.durationMinutes >= BLOCK_MIN_MINUTES &&
    s.durationMinutes <= BLOCK_MAX_MINUTES &&
    s.startMinutes + s.durationMinutes <= 24 * 60
  );
}

function applyChanges(
  blocks: RoutineBlock[],
  changes: ProposalChange[],
): RoutineBlock[] | 'bloco_inexistente' | 'horario_invalido' | 'conflito' {
  let next = blocks.map((b) => ({ ...b }));
  for (const ch of changes) {
    const i = next.findIndex((b) => b.id === ch.blockId);
    if (i < 0) return 'bloco_inexistente';
    if (!validSlot(ch.to)) return 'horario_invalido';
    if (next.some((o) => o.id !== ch.blockId && slotOverlaps(ch.to, blockSlot(o)))) return 'conflito';
    next = next.map((b, j) => (j === i ? { ...b, ...ch.to } : b));
  }
  return next;
}

function decide(
  proposal: WeeklyProposal,
  blocks: RoutineBlock[],
  changes: ProposalChange[],
  state: 'aceita' | 'editada',
  now: number,
): ApprovalResult {
  if (proposal.state !== 'pendente') return { ok: false, reason: 'ja_decidida' };
  const applied = applyChanges(blocks, changes);
  if (typeof applied === 'string') return { ok: false, reason: applied };
  return {
    ok: true,
    blocks: applied,
    proposal: { ...proposal, changes, state, decidedAt: now },
    undo: {
      proposalBefore: proposal,
      blocksBefore: blocks,
      expiresAt: now + WEEKLY_AI.undoSeconds * 1000,
    },
  };
}

/** Aceita: aplica as mudanças como estão. Nada muda antes de a pessoa aprovar. */
export function acceptProposal(proposal: WeeklyProposal, blocks: RoutineBlock[], now: number): ApprovalResult {
  return decide(proposal, blocks, proposal.changes, 'aceita', now);
}

/** Edita o horário de destino de uma mudança e aplica. */
export function editProposal(
  proposal: WeeklyProposal,
  blocks: RoutineBlock[],
  changeIndex: number,
  newTo: BlockSlot,
  now: number,
): ApprovalResult {
  const changes = proposal.changes.map((c, i) => (i === changeIndex ? { ...c, to: { ...newTo } } : c));
  return decide(proposal, blocks, changes, 'editada', now);
}

/** Nega: guarda o estado; o bloco e o tipo ficam em quarentena (ver cooledDownKeys). */
export function denyProposal(proposal: WeeklyProposal, now: number): WeeklyProposal {
  if (proposal.state !== 'pendente') return proposal;
  return { ...proposal, state: 'negada', decidedAt: now };
}

/** Desfaz dentro de undoSeconds. Devolve null se a janela passou. */
export function undoDecision(
  token: UndoToken,
  now: number,
): { proposal: WeeklyProposal; blocks: RoutineBlock[] } | null {
  if (now > token.expiresAt) return null;
  return { proposal: token.proposalBefore, blocks: token.blocksBefore };
}
