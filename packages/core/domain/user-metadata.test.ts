import type { User } from './types';
import {
  applyUserMetadataPatch,
  DEFAULT_USER_METADATA,
  metadataPatchFromUser,
  readUserMetadata,
  userFromMetadata,
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

describe('perfil nos metadados', () => {
  const user: User = {
    id: 'conta-1',
    frogName: 'Pulinho',
    timezone: 'America/Recife',
    dayStartMinutes: 6 * 60,
    dayEndMinutes: 21 * 60,
    theme: 'escuro',
    reduceMotion: true,
    createdAt: NOW,
  };

  it('metadados antigos, sem profile, continuam válidos e leem profile nulo', () => {
    const antigo = {
      version: 1,
      theme: 'claro',
      reduceMotion: false,
      timezone: 'America/Sao_Paulo',
      onboarding: { completed: true, completedAt: NOW },
    };
    const lido = readUserMetadata(antigo);
    expect(lido.theme).toBe('claro');
    expect(lido.onboarding.completed).toBe(true);
    expect(lido.profile).toBeNull();
    expect(userFromMetadata('x', lido)).toBeNull();
  });

  it('User vai para a conta e volta igual', () => {
    const patch = metadataPatchFromUser(user);
    expect(userMetadataPatchSchema.safeParse(patch).success).toBe(true);
    const metadata = applyUserMetadataPatch(DEFAULT_USER_METADATA, patch, NOW + 5);
    expect(metadata.onboarding).toEqual({ completed: true, completedAt: NOW + 5 });
    expect(userFromMetadata(user.id, metadata)).toEqual(user);
  });

  it('profile nulo no patch apaga o perfil; ausente não mexe', () => {
    const com = applyUserMetadataPatch(DEFAULT_USER_METADATA, metadataPatchFromUser(user), NOW);
    expect(applyUserMetadataPatch(com, { theme: 'claro' }, NOW).profile).toEqual(com.profile);
    expect(applyUserMetadataPatch(com, { profile: null, onboardingCompleted: false }, NOW)).toEqual({
      ...com,
      profile: null,
      onboarding: { completed: false, completedAt: null },
    });
  });

  it('valida nome, horas e fim depois do início', () => {
    const base = { frogName: 'Zé', dayStartMinutes: 420, dayEndMinutes: 1320, createdAt: NOW };
    const aceita = (profile: unknown) => userMetadataPatchSchema.safeParse({ profile }).success;
    expect(aceita(base)).toBe(true);
    expect(aceita({ ...base, frogName: '   ' })).toBe(false);
    expect(aceita({ ...base, frogName: 'x'.repeat(25) })).toBe(false);
    expect(aceita({ ...base, dayEndMinutes: 420 })).toBe(false);
    expect(aceita({ ...base, dayEndMinutes: 1441 })).toBe(false);
    expect(aceita({ ...base, dayStartMinutes: -1 })).toBe(false);
    expect(aceita({ ...base, extra: 1 })).toBe(true); // campos extras são ignorados pelo objeto do perfil
  });
});
