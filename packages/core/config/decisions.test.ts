import {
  LAGOON_PROGRESS_ITEMS_MIN_CARE_DAYS,
  PERIODS,
  PHASE_MIN_CARE_DAYS,
  STABLE_WEEK_MIN_CARE_DAYS,
} from './decisions';

describe('decisions', () => {
  test('fases crescem com os dias de cuidado', () => {
    const v = [1, 2, 3, 4].map((p) => PHASE_MIN_CARE_DAYS[p as 1 | 2 | 3 | 4]);
    expect(v).toEqual([0, 3, 8, 15]);
    expect([...v].sort((a, b) => a - b)).toEqual(v);
  });

  test('períodos não se sobrepõem', () => {
    expect(PERIODS.manha.endHour).toBe(PERIODS.tarde.startHour);
    expect(PERIODS.tarde.endHour).toBe(PERIODS.noite.startHour);
  });

  test('itens de progresso começam na pedra com 0 dias', () => {
    expect(LAGOON_PROGRESS_ITEMS_MIN_CARE_DAYS.pedra).toBe(0);
    expect(Object.keys(LAGOON_PROGRESS_ITEMS_MIN_CARE_DAYS)).toHaveLength(6);
    expect(STABLE_WEEK_MIN_CARE_DAYS).toBe(5);
  });
});
