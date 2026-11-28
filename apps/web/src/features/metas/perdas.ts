import { JOIAS } from '@pulo/core/config/decisions';
import { marcosPagos } from '@pulo/core/domain/joias';
import type { EntityId, Goal, GoalChest } from '@pulo/core/domain/types';

const joiasDosMarcos = (metas: readonly Goal[]) => marcosPagos(metas).length * JOIAS.por.milestoneDone;

/** As joias que saem do saldo ao excluir um marco (o teto por dia conta: outro marco pode passar a pagar). */
export function joiasPerdidasNoMarco(metas: readonly Goal[], goalId: EntityId, marcoId: EntityId): number {
  const sem = metas.map((m) => (m.id === goalId ? { ...m, milestones: m.milestones.filter((x) => x.id !== marcoId) } : m));
  return joiasDosMarcos(metas) - joiasDosMarcos(sem);
}

/** As joias que saem do saldo ao excluir a meta: as dos marcos riscados e as do baú aberto. */
export function joiasPerdidasNaMeta(metas: readonly Goal[], baus: readonly GoalChest[], goalId: EntityId): number {
  const bau = baus.filter((b) => b.goalId === goalId).reduce((total, b) => total + b.joias, 0);
  return joiasDosMarcos(metas) - joiasDosMarcos(metas.filter((m) => m.id !== goalId)) + bau;
}

export const avisoDePerda = (joias: number): string => (joias === 0 ? '' : ` Você perde ${joias === 1 ? '1 joia' : `${joias} joias`}.`);
