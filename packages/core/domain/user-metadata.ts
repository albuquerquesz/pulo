import { z } from 'zod';

import { AMBIENT_SOUNDS, DEFAULT_TIMEZONE, FOCUS, PREFERENCES } from '../config/decisions';
import { addDays, dateKeyOf, isDateKey } from './day';
import type { EntityId, Preferences, User, Vacation } from './types';

/** Limite técnico do nome do sapo (o campo do onboarding também usa 24). */
export const FROG_NAME_MAX_CHARS = 24;

/**
 * Metadados do usuário guardados na conta (coluna JSON `metadata` da API).
 * Preferências, progresso do onboarding e o perfil do app (nome do sapo e horário do dia).
 * Rotina, hábitos e sessões ficam nas tabelas próprias, não aqui.
 * A versão continua 1: o `profile` e as preferências são opcionais na leitura (contas antigas leem `null` e os padrões).
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

const focusMinutesSchema = z.number().int().min(FOCUS.minMinutes).max(FOCUS.maxMinutes);
const breakMinutesSchema = z.number().int().min(FOCUS.minBreakMinutes).max(FOCUS.maxBreakMinutes);
const dailyFocusGoalSchema = z
  .number()
  .int()
  .min(PREFERENCES.minDailyFocusGoalMinutes)
  .max(PREFERENCES.maxDailyFocusGoalMinutes)
  .nullable();
const eveningReminderSchema = z.strictObject({
  ligado: z.boolean(),
  minutos: z.number().int().min(0).max(MINUTES_PER_DAY - 1),
});
const dateKeySchema = z.string().refine(isDateKey);
const vacationSchema = z.object({
  ligado: z.boolean(),
  desde: dateKeySchema.nullable(),
  periodos: z.array(z.object({ de: dateKeySchema, ate: dateKeySchema })),
});
const ambientSoundSchema = z.enum(AMBIENT_SOUNDS);

export const DEFAULT_PREFERENCES: Preferences = {
  focusMinutes: FOCUS.defaultMinutes,
  breakMinutes: FOCUS.defaultBreakMinutes,
  dailyFocusGoalMinutes: null,
  eveningReminder: { ligado: false, minutos: PREFERENCES.eveningReminderMinutes },
  vacation: { ligado: false, desde: null, periodos: [] },
  sounds: PREFERENCES.sounds,
  aiEnabled: PREFERENCES.aiEnabled,
  ambientSound: PREFERENCES.ambientSound,
};

// Na leitura, preferência ausente ou fora dos limites de agora vira o padrão (`catch`), sem derrubar o resto da conta.
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
  focusMinutes: focusMinutesSchema.default(DEFAULT_PREFERENCES.focusMinutes).catch(DEFAULT_PREFERENCES.focusMinutes),
  breakMinutes: breakMinutesSchema.default(DEFAULT_PREFERENCES.breakMinutes).catch(DEFAULT_PREFERENCES.breakMinutes),
  dailyFocusGoalMinutes: dailyFocusGoalSchema.default(DEFAULT_PREFERENCES.dailyFocusGoalMinutes).catch(DEFAULT_PREFERENCES.dailyFocusGoalMinutes),
  eveningReminder: eveningReminderSchema.default(DEFAULT_PREFERENCES.eveningReminder).catch(DEFAULT_PREFERENCES.eveningReminder),
  vacation: vacationSchema.default(DEFAULT_PREFERENCES.vacation).catch(DEFAULT_PREFERENCES.vacation),
  sounds: z.boolean().default(DEFAULT_PREFERENCES.sounds).catch(DEFAULT_PREFERENCES.sounds),
  aiEnabled: z.boolean().default(DEFAULT_PREFERENCES.aiEnabled).catch(DEFAULT_PREFERENCES.aiEnabled),
  ambientSound: ambientSoundSchema.default(DEFAULT_PREFERENCES.ambientSound).catch(DEFAULT_PREFERENCES.ambientSound),
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
  focusMinutes: focusMinutesSchema.optional(),
  breakMinutes: breakMinutesSchema.optional(),
  dailyFocusGoalMinutes: dailyFocusGoalSchema.optional(),
  eveningReminder: eveningReminderSchema.optional(),
  /** Só liga ou desliga: as datas são marcadas pelo servidor. */
  vacation: z.strictObject({ ligado: z.boolean() }).optional(),
  sounds: z.boolean().optional(),
  aiEnabled: z.boolean().optional(),
  ambientSound: ambientSoundSchema.optional(),
});

export type UserMetadataPatch = z.infer<typeof userMetadataPatchSchema>;

/** A parte do patch que muda preferências (spec 15). */
export type PreferencesPatch = Omit<UserMetadataPatch, 'theme' | 'reduceMotion' | 'timezone' | 'onboardingCompleted' | 'profile'>;

export const DEFAULT_USER_METADATA: UserMetadata = {
  version: USER_METADATA_VERSION,
  theme: 'sistema',
  reduceMotion: false,
  timezone: DEFAULT_TIMEZONE,
  onboarding: { completed: false, completedAt: null },
  profile: null,
  ...DEFAULT_PREFERENCES,
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
  // O Better Auth grava campos `json` como texto: lido direto do banco (sem passar pela sessão), chega como string.
  const parsed = userMetadataSchema.safeParse(typeof stored === 'string' ? jsonOuNulo(stored) : stored);
  return parsed.success ? parsed.data : DEFAULT_USER_METADATA;
}

function jsonOuNulo(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

/** Aplica um patch já validado. `now` marca a conclusão do onboarding e os dias das férias. */
export function applyUserMetadataPatch(current: UserMetadata, patch: UserMetadataPatch, now: number): UserMetadata {
  const { onboardingCompleted, theme, reduceMotion, timezone, profile, vacation, dailyFocusGoalMinutes, ...preferences } = patch;
  const zone = timezone ?? current.timezone;
  const dayStartMinutes = (profile === undefined ? current.profile : profile)?.dayStartMinutes;
  return {
    ...current,
    focusMinutes: preferences.focusMinutes ?? current.focusMinutes,
    breakMinutes: preferences.breakMinutes ?? current.breakMinutes,
    // Ausente não mexe; `null` tira a meta.
    dailyFocusGoalMinutes: dailyFocusGoalMinutes === undefined ? current.dailyFocusGoalMinutes : dailyFocusGoalMinutes,
    eveningReminder: preferences.eveningReminder ?? current.eveningReminder,
    sounds: preferences.sounds ?? current.sounds,
    aiEnabled: preferences.aiEnabled ?? current.aiEnabled,
    ambientSound: preferences.ambientSound ?? current.ambientSound,
    vacation: vacation === undefined ? current.vacation : toggleVacation(current.vacation, vacation.ligado, dateKeyOf(now, zone, dayStartMinutes)),
    theme: theme ?? current.theme,
    reduceMotion: reduceMotion ?? current.reduceMotion,
    timezone: zone,
    // Ausente não mexe; `null` apaga.
    profile: profile === undefined ? current.profile : profile,
    onboarding: nextOnboarding(current.onboarding, onboardingCompleted, now),
  };
}

/**
 * Liga ou desliga o modo férias em `today`. Ao desligar, os dias de férias (até hoje) viram um período guardado,
 * para a sequência não quebrar depois. Repetir o mesmo estado não muda nada.
 */
function toggleVacation(current: Vacation, ligado: boolean, today: string): Vacation {
  if (ligado === current.ligado) return current;
  const { periodos } = current;
  if (!ligado) {
    const de = current.desde ?? today;
    const ate = de > today ? de : today;
    return { ligado, desde: null, periodos: [...periodos, { de, ate }].slice(-PREFERENCES.maxVacationPeriods) };
  }
  // Religar no mesmo dia (ou logo no seguinte) continua o último período em vez de criar outro.
  const last = periodos.at(-1);
  if (last && last.ate >= addDays(today, -1)) return { ligado, desde: last.de, periodos: periodos.slice(0, -1) };
  return { ligado, desde: today, periodos };
}

/** As preferências da conta, sem o resto dos metadados. */
export function preferencesFromMetadata(metadata: UserMetadata): Preferences {
  const { focusMinutes, breakMinutes, dailyFocusGoalMinutes, eveningReminder, vacation, sounds, aiEnabled, ambientSound } = metadata;
  return {
    focusMinutes,
    breakMinutes,
    dailyFocusGoalMinutes,
    eveningReminder: { ...eveningReminder },
    vacation: { ...vacation, periodos: vacation.periodos.map((p) => ({ ...p })) },
    sounds,
    aiEnabled,
    ambientSound,
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
