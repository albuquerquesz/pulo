import { BLOCK_MAX_MINUTES, BLOCK_MIN_MINUTES, FOCUS } from '../config/decisions';
import {
  dateKeySchema,
  dateRangeQuerySchema,
  focusSessionSchema,
  idSchema,
  routineBlockSchema,
  syncQuerySchema,
} from './schemas';

const block = { id: 'b1', weekday: 0, startMinutes: 0, durationMinutes: 30, kind: 'foco' };

describe('schemas da API seguem config/decisions', () => {
  it('duração do bloco vai de BLOCK_MIN_MINUTES a BLOCK_MAX_MINUTES', () => {
    for (const durationMinutes of [BLOCK_MIN_MINUTES - 1, BLOCK_MIN_MINUTES, BLOCK_MAX_MINUTES, BLOCK_MAX_MINUTES + 1]) {
      const ok = durationMinutes >= BLOCK_MIN_MINUTES && durationMinutes <= BLOCK_MAX_MINUTES;
      expect(routineBlockSchema.safeParse({ ...block, durationMinutes }).success).toBe(ok);
    }
  });

  it('foco planejado vai de FOCUS.minMinutes a FOCUS.maxMinutes', () => {
    const session = { id: 's', startedAt: 1, state: 'em_andamento', pausedMs: 0 };
    for (const plannedMinutes of [FOCUS.minMinutes - 1, FOCUS.minMinutes, FOCUS.maxMinutes, FOCUS.maxMinutes + 1]) {
      const ok = plannedMinutes >= FOCUS.minMinutes && plannedMinutes <= FOCUS.maxMinutes;
      expect(focusSessionSchema.safeParse({ ...session, plannedMinutes }).success).toBe(ok);
    }
  });
});

describe('primitivos', () => {
  it('ids só aceitam caracteres seguros para URL', () => {
    expect(idSchema.safeParse(crypto.randomUUID()).success).toBe(true);
    expect(idSchema.safeParse('habito-abc-1').success).toBe(true);
    for (const bad of ['', 'a/b', 'a b', '../x', 'x'.repeat(65)]) expect(idSchema.safeParse(bad).success).toBe(false);
  });

  it('datas precisam existir', () => {
    expect(dateKeySchema.safeParse('2028-02-29').success).toBe(true);
    for (const bad of ['2026-02-29', '2026-13-01', '2026-1-1', 'hoje']) expect(dateKeySchema.safeParse(bad).success).toBe(false);
  });

  it('intervalos: from <= to e limite do sync', () => {
    expect(dateRangeQuerySchema.safeParse({}).success).toBe(true);
    expect(dateRangeQuerySchema.safeParse({ from: '2026-11-02', to: '2026-11-01' }).success).toBe(false);
    expect(syncQuerySchema.safeParse({ from: '2026-01-01', to: '2026-12-31' }).success).toBe(true);
    expect(syncQuerySchema.safeParse({ from: '2024-01-01', to: '2026-12-31' }).success).toBe(false);
  });
});
