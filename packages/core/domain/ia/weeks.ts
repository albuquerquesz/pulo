import type { DateKey } from '../types';

/** Dias entre duas DateKey (b menos a), por aritmética de calendário pura. */
export function daysBetween(a: DateKey, b: DateKey): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

/** Semanas inteiras entre duas segundas (b menos a). */
export function weeksBetween(a: DateKey, b: DateKey): number {
  return Math.round(daysBetween(a, b) / 7);
}
