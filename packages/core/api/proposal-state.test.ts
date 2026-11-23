import { WEEKLY_AI } from '../config/decisions';
import type { ProposalState, WeeklyProposal } from '../domain/types';
import { PROPOSAL_UNDO_GRACE_MS, checkProposalTransition } from './proposal-state';

const base: WeeklyProposal = {
  id: 'p1',
  weekStart: '2026-11-23',
  state: 'pendente',
  patternText: 'padrão',
  changes: [],
  origin: 'regra',
  createdAt: 1_000,
};
const withState = (state: ProposalState, decidedAt?: number): WeeklyProposal =>
  decidedAt === undefined ? { ...base, state } : { ...base, state, decidedAt };
const same = (a: WeeklyProposal, b: WeeklyProposal) => JSON.stringify(a) === JSON.stringify(b);

describe('checkProposalTransition', () => {
  it('pendente decide para qualquer estado', () => {
    for (const to of ['aceita', 'editada', 'negada', 'expirada'] as const) {
      expect(checkProposalTransition(base, withState(to, 5_000), 5_000, same)).toBeNull();
    }
  });

  it('decidida só volta para pendente dentro da janela de desfazer', () => {
    const accepted = withState('aceita', 10_000);
    const window = WEEKLY_AI.undoSeconds * 1000 + PROPOSAL_UNDO_GRACE_MS;
    expect(checkProposalTransition(accepted, base, 10_000 + window, same)).toBeNull();
    expect(checkProposalTransition(accepted, base, 10_000 + window + 1, same)).toBe('proposta_transicao_invalida');
  });

  it('decidida não vai para outra decisão e expirada é final', () => {
    expect(checkProposalTransition(withState('aceita', 1), withState('negada', 2), 3, same)).toBe('proposta_transicao_invalida');
    expect(checkProposalTransition(withState('expirada', 1), base, 2, same)).toBe('proposta_transicao_invalida');
  });

  it('repetir a mesma decisão é idempotente, mudar o conteúdo não', () => {
    const accepted = withState('aceita', 10_000);
    expect(checkProposalTransition(accepted, { ...accepted }, 99_999_999, same)).toBeNull();
    expect(checkProposalTransition(accepted, { ...accepted, patternText: 'outro' }, 99_999_999, same)).toBe(
      'proposta_transicao_invalida',
    );
  });

  it('semana, origem e criação não mudam', () => {
    expect(checkProposalTransition(base, { ...base, weekStart: '2026-11-30' }, 2, same)).toBe('proposta_imutavel');
    expect(checkProposalTransition(base, { ...base, origin: 'ia' }, 2, same)).toBe('proposta_imutavel');
  });
});
