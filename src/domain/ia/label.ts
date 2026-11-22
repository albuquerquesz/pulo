import type { ProposalOrigin } from '@/domain/types';

/** Rótulo honesto: só diz IA quando a IA realmente foi usada. */
export function proposalLabel(origin: ProposalOrigin): string {
  return origin === 'ia' ? 'Sugestão da IA' : 'Sugestão';
}

export const GETTING_TO_KNOW_TEXT = 'Ainda estou conhecendo sua semana';
