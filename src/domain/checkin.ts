import { ENERGY_MAX, ENERGY_MIN } from '@/config/decisions';
import { dateKeyOf, periodOf } from './day';
import { newId } from './ids';
import { fail, ok, type Result } from './result';
import type { CheckIn, DateKey, Energy, Period, PeriodEnergyStats, Repository } from './types';

/** Texto único da pergunta, usado em toda parte. */
export const CHECKIN_QUESTION = 'Como está sua energia agora?';
export const CHECKIN_LOW_ENERGY_COPY = 'Parece que hoje pede casco. Quer um dia mais leve?';
export const ENERGY_LABELS: Record<Energy, string> = {
  1: 'muito baixa',
  2: 'baixa',
  3: 'média',
  4: 'alta',
  5: 'muito alta',
};

export function energyA11yLabel(energy: Energy): string {
  return `Energia ${energy} de 5`;
}

export function isValidEnergy(value: unknown): value is Energy {
  return typeof value === 'number' && Number.isInteger(value) && value >= ENERGY_MIN && value <= ENERGY_MAX;
}

/** Registra a energia do período atual. Responder de novo no mesmo período troca o valor (vale o último). */
export async function registrarCheckIn(
  repo: Repository,
  energy: number,
  now: number,
  timeZone: string,
): Promise<Result<CheckIn, 'energia_invalida'>> {
  if (!isValidEnergy(energy)) return fail('energia_invalida', `A energia vai de ${ENERGY_MIN} a ${ENERGY_MAX}.`);
  const date = dateKeyOf(now, timeZone);
  const period = periodOf(now, timeZone);
  const existing = (await repo.listCheckIns({ from: date, to: date })).find((c) => c.period === period);
  const checkIn: CheckIn = { id: existing?.id ?? newId(now, 'checkin'), date, period, energy, createdAt: now };
  await repo.saveCheckIn(checkIn);
  return ok(checkIn);
}

/** Já existe resposta neste período do dia lógico? */
export function hasCheckInInPeriod(checkIns: readonly CheckIn[], date: DateKey, period: Period): boolean {
  return checkIns.some((c) => c.date === date && c.period === period);
}

/** Chave do convite de um período, para guardar "ignorado" na interface. */
export function inviteKey(date: DateKey, period: Period): string {
  return `${date}:${period}`;
}

/**
 * Mostrar o convite na tela Hoje? No máximo um por período, e some se respondido ou ignorado.
 * `dismissed` é o conjunto de chaves ignoradas (guardado pela interface, só em memória da sessão).
 */
export function shouldInvite(
  checkIns: readonly CheckIn[],
  now: number,
  timeZone: string,
  dismissed: ReadonlySet<string> = new Set(),
): boolean {
  const date = dateKeyOf(now, timeZone);
  const period = periodOf(now, timeZone);
  return !hasCheckInInPeriod(checkIns, date, period) && !dismissed.has(inviteKey(date, period));
}

/** Pergunta opcional ao fim do foco: só sem resposta no período. */
export function shouldAskAfterFocus(checkIns: readonly CheckIn[], now: number, timeZone: string): boolean {
  return !hasCheckInInPeriod(checkIns, dateKeyOf(now, timeZone), periodOf(now, timeZone));
}

/** Energia mais recente do dia lógico, ou null. */
export function latestEnergyToday(checkIns: readonly CheckIn[], now: number, timeZone: string): Energy | null {
  const date = dateKeyOf(now, timeZone);
  let latest: CheckIn | null = null;
  for (const c of checkIns) {
    if (c.date === date && (!latest || c.createdAt >= latest.createdAt)) latest = c;
  }
  return latest ? latest.energy : null;
}

/** Média e contagem por período, só com os check ins daquele período. */
export function energyByPeriod(checkIns: readonly CheckIn[]): Record<Period, PeriodEnergyStats> {
  const acc: Record<Period, { sum: number; n: number }> = {
    manha: { sum: 0, n: 0 },
    tarde: { sum: 0, n: 0 },
    noite: { sum: 0, n: 0 },
  };
  for (const c of checkIns) {
    acc[c.period].sum += c.energy;
    acc[c.period].n += 1;
  }
  const out = {} as Record<Period, PeriodEnergyStats>;
  for (const p of ['manha', 'tarde', 'noite'] as Period[]) {
    out[p] = { average: acc[p].n === 0 ? null : acc[p].sum / acc[p].n, checkIns: acc[p].n };
  }
  return out;
}
