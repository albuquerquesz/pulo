import {
  applyUserMetadataPatch,
  DEFAULT_USER_METADATA,
  readUserMetadata,
  userMetadataPatchSchema,
} from './user-metadata';

const NOW = 1_795_000_000_000;

describe('metadados do usuário', () => {
  it('banco vazio ou inválido vira o padrão', () => {
    expect(readUserMetadata(null)).toEqual(DEFAULT_USER_METADATA);
    expect(readUserMetadata({ theme: 'roxo' })).toEqual(DEFAULT_USER_METADATA);
  });

  it('aplica preferências e marca o onboarding uma vez só', () => {
    const first = applyUserMetadataPatch(DEFAULT_USER_METADATA, { theme: 'escuro', onboardingCompleted: true }, NOW);
    expect(first.theme).toBe('escuro');
    expect(first.onboarding).toEqual({ completed: true, completedAt: NOW });

    const again = applyUserMetadataPatch(first, { onboardingCompleted: true }, NOW + 1000);
    expect(again.onboarding.completedAt).toBe(NOW);

    const reset = applyUserMetadataPatch(again, { onboardingCompleted: false }, NOW);
    expect(reset.onboarding).toEqual({ completed: false, completedAt: null });
  });

  it('patch recusa campo desconhecido, tema inválido e fuso inválido', () => {
    expect(userMetadataPatchSchema.safeParse({ frogName: 'Zé' }).success).toBe(false);
    expect(userMetadataPatchSchema.safeParse({ theme: 'roxo' }).success).toBe(false);
    expect(userMetadataPatchSchema.safeParse({ timezone: 'Lua/Base' }).success).toBe(false);
    expect(userMetadataPatchSchema.safeParse({ timezone: 'America/Recife' }).success).toBe(true);
  });
});
