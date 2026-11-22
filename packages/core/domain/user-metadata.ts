import { z } from 'zod';

import { DEFAULT_TIMEZONE } from '../config/decisions';
import type { User } from './types';

/**
 * Metadados do usuário guardados na conta (coluna JSON `metadata` da API).
 * Só preferências e progresso do app: nada de rotina, hábitos ou nome do sapo,
 * que continuam só no aparelho.
 */
export const USER_METADATA_VERSION = 1;

const themeSchema = z.enum(['claro', 'escuro', 'sistema']) satisfies z.ZodType<User['theme']>;

const timezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(isValidTimezone, { message: 'fuso IANA inválido' });

export const userMetadataSchema = z.object({
  version: z.literal(USER_METADATA_VERSION),
  theme: themeSchema,
  reduceMotion: z.boolean(),
  timezone: timezoneSchema,
  onboarding: z.object({
    completed: z.boolean(),
    /** Epoch em ms de quando o onboarding foi concluído. */
    completedAt: z.number().int().nonnegative().nullable(),
  }),
});

export type UserMetadata = z.infer<typeof userMetadataSchema>;

/** O que o app pode mudar. Campos fora da lista são recusados. */
export const userMetadataPatchSchema = z.strictObject({
  theme: themeSchema.optional(),
  reduceMotion: z.boolean().optional(),
  timezone: timezoneSchema.optional(),
  onboardingCompleted: z.boolean().optional(),
});

export type UserMetadataPatch = z.infer<typeof userMetadataPatchSchema>;

export const DEFAULT_USER_METADATA: UserMetadata = {
  version: USER_METADATA_VERSION,
  theme: 'sistema',
  reduceMotion: false,
  timezone: DEFAULT_TIMEZONE,
  onboarding: { completed: false, completedAt: null },
};

function isValidTimezone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Lê o que veio do banco. Vazio ou fora do formato vira o padrão. */
export function readUserMetadata(stored: unknown): UserMetadata {
  const parsed = userMetadataSchema.safeParse(stored);
  return parsed.success ? parsed.data : DEFAULT_USER_METADATA;
}

/** Aplica um patch já validado. `now` marca a conclusão do onboarding. */
export function applyUserMetadataPatch(current: UserMetadata, patch: UserMetadataPatch, now: number): UserMetadata {
  const { onboardingCompleted, ...preferences } = patch;
  return {
    ...current,
    ...preferences,
    onboarding: nextOnboarding(current.onboarding, onboardingCompleted, now),
  };
}

function nextOnboarding(current: UserMetadata['onboarding'], completed: boolean | undefined, now: number) {
  if (completed === undefined) return current;
  if (!completed) return { completed: false, completedAt: null };
  return { completed: true, completedAt: current.completedAt ?? now };
}
