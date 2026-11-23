import { WEEKLY_AI } from '../config/decisions';
import type { WeeklyProposal } from '../domain/types';

/** Folga para a janela de desfazer: o pedido chega depois dos `undoSeconds` do relógio do app. */
export const PROPOSAL_UNDO_GRACE_MS = 5_000;

export type ProposalTransitionError = 'proposta_imutavel' | 'proposta_transicao_invalida';

/**
 * Máquina de estados da proposta semanal, checada no servidor.
 *
 * - `pendente` vai para qualquer estado (aceita, editada, negada, expirada) ou continua pendente.
 * - Decidida (aceita, editada, negada) só volta para `pendente`, o "desfazer", dentro de `WEEKLY_AI.undoSeconds`
 *   (mais a folga de rede) depois de `decidedAt`.
 * - `expirada` é final.
 * - Repetir o mesmo estado é aceito (idempotência) quando o resto da proposta é igual; senão é transição inválida.
 * - `weekStart`, `origin` e `createdAt` nunca mudam depois de criada.
 *
 * Devolve `null` se a mudança é válida. Função pura: `now` é do servidor.
 */
export function checkProposalTransition(
  current: WeeklyProposal,
  next: WeeklyProposal,
  now: number,
  isSame: (a: WeeklyProposal, b: WeeklyProposal) => boolean,
): ProposalTransitionError | null {
  if (current.weekStart !== next.weekStart || current.origin !== next.origin || current.createdAt !== next.createdAt) {
    return 'proposta_imutavel';
  }
  if (current.state === next.state) {
    return current.state === 'pendente' || isSame(current, next) ? null : 'proposta_transicao_invalida';
  }
  if (current.state === 'pendente') return null;
  if (current.state === 'expirada') return 'proposta_transicao_invalida';
  const undoWindowMs = WEEKLY_AI.undoSeconds * 1000 + PROPOSAL_UNDO_GRACE_MS;
  const withinUndo = current.decidedAt !== undefined && now - current.decidedAt <= undoWindowMs;
  return next.state === 'pendente' && withinUndo ? null : 'proposta_transicao_invalida';
}
