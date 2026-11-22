import type { Clock } from '@/domain/types';
import { addDays, dateKeyOf, localToMs } from './time';

/** Instante inicial do demo: domingo 22/11/2026, 20h (hora local). Fim da 4a semana de dados. */
export const DEMO_START_DATE = '2026-11-22';
export const DEMO_START_MINUTES = 20 * 60;

export interface DemoClock extends Clock {
  advanceDays(n: number): void;
  advanceWeeks(n: number): void;
  /** Volta ao instante inicial. */
  reset(): void;
  today(): string;
}

export function createDemoClock(
  startMs: number = localToMs(DEMO_START_DATE, DEMO_START_MINUTES),
): DemoClock {
  let current = startMs;
  const DAY = 86_400_000;
  return {
    now: () => current,
    advanceDays(n) {
      current += n * DAY;
    },
    advanceWeeks(n) {
      current += n * 7 * DAY;
    },
    reset() {
      current = startMs;
    },
    today: () => dateKeyOf(current),
  };
}

export { addDays };
