import type { DateKey } from '@pulo/core/domain/types';

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** DateKey ('AAAA-MM-DD') para o Date que o Prisma usa em colunas `@db.Date` (meia noite UTC). */
export function dateKeyToDate(key: DateKey): Date {
  const match = DATE_KEY.exec(key);
  if (!match) throw new RangeError(`DateKey inválida: ${key}`);
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  // Rejeita datas que o Date "corrige", como 2026-02-31.
  if (dateToDateKey(date) !== key) throw new RangeError(`DateKey inválida: ${key}`);
  return date;
}

/** Date de uma coluna `@db.Date` para DateKey. */
export function dateToDateKey(date: Date): DateKey {
  return date.toISOString().slice(0, 10);
}

/** Instante do domínio (ms desde a época) para Date. */
export function msToDate(ms: number): Date {
  return new Date(ms);
}

/** Date de uma coluna timestamptz para instante em ms. */
export function dateToMs(date: Date): number {
  return date.getTime();
}
