import { DAY_ROLLOVER_HOUR, PERIODS } from '../config/decisions';
import type { DateKey, Period, Weekday } from './types';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** Data e hora de parede no fuso, para um instante. */
export function localParts(ts: number, timeZone: string): LocalParts {
  const out: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(new Date(ts))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return { year: out.year, month: out.month, day: out.day, hour: out.hour % 24, minute: out.minute };
}

function pad(n: number, size = 2): string {
  return String(n).padStart(size, '0');
}

export function toDateKey(year: number, month: number, day: number): DateKey {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/**
 * Dia LÓGICO de um instante: o dia vira às DAY_ROLLOVER_HOUR no fuso do usuário.
 * Às 03:30 ainda é o dia anterior. (Fusos sem horário de verão: o fuso padrão não tem.)
 * `rolloverMinutes` troca a hora da virada (a sequência usa o começo do dia da pessoa).
 */
export function dateKeyOf(ts: number, timeZone: string, rolloverMinutes: number = DAY_ROLLOVER_HOUR * 60): DateKey {
  const p = localParts(ts - rolloverMinutes * MINUTE_MS, timeZone);
  return toDateKey(p.year, p.month, p.day);
}

/** Minutos desde 00:00 locais (hora de parede) de um instante. */
export function localMinutesOf(ts: number, timeZone: string): number {
  const p = localParts(ts, timeZone);
  return p.hour * 60 + p.minute;
}

/**
 * Período do dia pela hora local. Horas fora das faixas (23h às 5h) caem em `noite`,
 * coerente com o dia lógico: 02h pertence à noite do dia anterior.
 */
export function periodOf(ts: number, timeZone: string): Period {
  const hour = localParts(ts, timeZone).hour;
  if (hour >= PERIODS.manha.startHour && hour < PERIODS.manha.endHour) return 'manha';
  if (hour >= PERIODS.tarde.startHour && hour < PERIODS.tarde.endHour) return 'tarde';
  return 'noite';
}

function keyToUtcDay(key: DateKey): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

function utcDayToKey(day: number): DateKey {
  const dt = new Date(day * DAY_MS);
  return toDateKey(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(key: DateKey, n: number): DateKey {
  return utcDayToKey(keyToUtcDay(key) + n);
}

export function diffDays(a: DateKey, b: DateKey): number {
  return keyToUtcDay(a) - keyToUtcDay(b);
}

/** 0 = segunda ... 6 = domingo. */
export function weekdayOf(key: DateKey): Weekday {
  const dow = new Date(keyToUtcDay(key) * DAY_MS).getUTCDay(); // 0 = domingo
  return ((dow + 6) % 7) as Weekday;
}

/** Segunda-feira da semana de uma data. */
export function weekStartOf(key: DateKey): DateKey {
  return addDays(key, -weekdayOf(key));
}

export function weekEndOf(key: DateKey): DateKey {
  return addDays(weekStartOf(key), 6);
}

export function weekDates(weekStart: DateKey): DateKey[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function inRange(key: DateKey, from: DateKey, to: DateKey): boolean {
  return key >= from && key <= to;
}

/** Instante (ms) do início do dia lógico `key` no fuso, às DAY_ROLLOVER_HOUR locais. Busca por aproximação. */
export function startOfLogicalDay(key: DateKey, timeZone: string): number {
  const [y, m, d] = key.split('-').map(Number);
  let guess = Date.UTC(y, m - 1, d, DAY_ROLLOVER_HOUR);
  for (let i = 0; i < 3; i += 1) {
    const p = localParts(guess, timeZone);
    const actual = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const wanted = Date.UTC(y, m - 1, d, DAY_ROLLOVER_HOUR);
    guess += wanted - actual;
  }
  return guess;
}
