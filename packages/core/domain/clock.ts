import type { Clock } from './types';

/** Relógio real, para uso só na borda do app (telas). O domínio recebe `Clock`. */
export const systemClock: Clock = { now: () => Date.now() };

/** Relógio fixo, para testes. */
export function fixedClock(ms: number): Clock & { set(ms: number): void; advance(ms: number): void } {
  let current = ms;
  return {
    now: () => current,
    set(next: number) {
      current = next;
    },
    advance(delta: number) {
      current += delta;
    },
  };
}

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
