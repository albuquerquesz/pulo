import { DAY_ROLLOVER_HOUR } from '@/config/decisions';
import type { DateKey, Weekday } from '@/domain/types';

/** Fuso do demo: America/Sao_Paulo sem horário de verão (UTC-3), fixo e determinístico. */
export const DEMO_UTC_OFFSET_HOURS = -3;

/** Instante (ms) de uma data local e hora local. */
export function localToMs(date: DateKey, minutesOfDay: number): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 0, 0) + (minutesOfDay - DEMO_UTC_OFFSET_HOURS * 60) * 60_000;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Dia lógico (vira às DAY_ROLLOVER_HOUR) de um instante. */
export function dateKeyOf(ms: number): DateKey {
  const shifted = new Date(ms + (DEMO_UTC_OFFSET_HOURS - DAY_ROLLOVER_HOUR) * 3_600_000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export function addDays(date: DateKey, n: number): DateKey {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = segunda ... 6 = domingo. */
export function weekdayOf(date: DateKey): Weekday {
  const [y, m, d] = date.split('-').map(Number);
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) as Weekday;
}
