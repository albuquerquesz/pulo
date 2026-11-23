import { z } from 'zod';

import { DEFAULT_TIMEZONE } from '../config/decisions';
import type { EntityId, User } from './types';

/** Limite técnico do nome do sapo (o campo do onboarding também usa 24). */
export const FROG_NAME_MAX_CHARS = 24;

/**
 * Metadados do usuário guardados na conta (coluna JSON `metadata` da API).
 * Preferências, progresso do onboarding e o perfil do app (nome do sapo e horário do dia).
 * Rotina, hábitos e sessões ficam nas tabelas próprias, não aqui.
 * A versão continua 1: o `profile` é opcional na leitura (contas antigas não o têm e leem `null`).
 */
export const USER_METADATA_VERSION = 1;

const themeSchema = z.enum(['claro', 'escuro', 'sistema']) satisfies z.ZodType<User['theme']>;

const timezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(isValidTimezone, { message: 'fuso IANA inválido' });

const MINUTES_PER_DAY = 24 * 60;

/** Perfil do app: o que o `User` do domínio tem além das preferências. Nulo até o onboarding terminar. */
export const userProfileSchema = z
  .object({
    /** Nome do sapo (nunca enviado à IA). */
    frogName: z.string().trim().min(1).max(FROG_NAME_MAX_CHARS),
    dayStartMinutes: z.number().int().min(0).max(MINUTES_PER_DAY - 1),
    dayEndMinutes: z.number().int().min(1).max(MINUTES_PER_DAY),
    /** Epoch em ms de quando o perfil foi criado. */
    createdAt: z.number().int().nonnegative(),
  })
  .refine((p) => p.dayEndMinutes > p.dayStartMinutes, { message: 'o dia precisa terminar depois de começar' });

export type UserProfile = z.infer<typeof userProfileSchema>;

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
  profile: userProfileSchema.nullable().default(null),
});

export type UserMetadata = z.infer<typeof userMetadataSchema>;

/** O que o app pode mudar. Campos fora da lista são recusados. */
export const userMetadataPatchSchema = z.strictObject({
  theme: themeSchema.optional(),
  reduceMotion: z.boolean().optional(),
  timezone: timezoneSchema.optional(),
  onboardingCompleted: z.boolean().optional(),
  /** Troca o perfil inteiro; `null` apaga (usado ao apagar todos os dados). */
  profile: userProfileSchema.nullable().optional(),
});

export type UserMetadataPatch = z.infer<typeof userMetadataPatchSchema>;

export const DEFAULT_USER_METADATA: UserMetadata = {
  version: USER_METADATA_VERSION,
  theme: 'sistema',
  reduceMotion: false,
  timezone: DEFAULT_TIMEZONE,
  onboarding: { completed: false, completedAt: null },
  profile: null,
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
  const { onboardingCompleted, theme, reduceMotion, timezone, profile } = patch;
  return {
    ...current,
    theme: theme ?? current.theme,
    reduceMotion: reduceMotion ?? current.reduceMotion,
    timezone: timezone ?? current.timezone,
    // Ausente não mexe; `null` apaga.
    profile: profile === undefined ? current.profile : profile,
    onboarding: nextOnboarding(current.onboarding, onboardingCompleted, now),
  };
}

function nextOnboarding(current: UserMetadata['onboarding'], completed: boolean | undefined, now: number) {
  if (completed === undefined) return current;
  if (!completed) return { completed: false, completedAt: null };
  return { completed: true, completedAt: current.completedAt ?? now };
}

// ---------- User <-> metadados (único lugar do mapeamento) ----------

/**
 * `User` do domínio a partir da conta. `null` enquanto não há perfil (onboarding por fazer).
 * O `id` é o da conta (Better Auth).
 */
export function userFromMetadata(id: EntityId, metadata: UserMetadata): User | null {
  if (!metadata.profile) return null;
  const { frogName, dayStartMinutes, dayEndMinutes, createdAt } = metadata.profile;
  return {
    id,
    frogName,
    timezone: metadata.timezone,
    dayStartMinutes,
    dayEndMinutes,
    theme: metadata.theme,
    reduceMotion: metadata.reduceMotion,
    createdAt,
  };
}

/** O patch que grava um `User` na conta. Também marca o onboarding como concluído (a existência do perfil é o onboarding). */
export function metadataPatchFromUser(user: User): UserMetadataPatch {
  return {
    theme: user.theme,
    reduceMotion: user.reduceMotion,
    timezone: user.timezone,
    onboardingCompleted: true,
    profile: {
      frogName: user.frogName.trim(),
      dayStartMinutes: user.dayStartMinutes,
      dayEndMinutes: user.dayEndMinutes,
      createdAt: user.createdAt,
    },
  };
}
