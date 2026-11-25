import { PHASE_MIN_CARE_DAYS, STABLE_WEEK_MIN_CARE_DAYS } from '../config/decisions';
import { careDayKeys, countCareDays, sessionCountsAsCare } from './care-days';
import { addDays, dateKeyOf, periodOf, startOfLogicalDay, weekdayOf, weekStartOf } from './day';
import { computeMascotState, phaseForCareDays, refreshMascotState, resolvePhase } from './phase';
import { endedSession, sp, TZ } from './test-utils';
import { buildWeekSummary, loadWeekSummary } from './week-summary';
import { createMemoryRepository } from '../data/memory-repository';
import type { FocusSession, RestDay } from './types';

describe('dia lógico', () => {
  it('23:50 conta para o dia, 03:30 conta para o dia anterior', () => {
    expect(dateKeyOf(sp(2026, 11, 10, 23, 50), TZ)).toBe('2026-11-10');
    expect(dateKeyOf(sp(2026, 11, 11, 3, 30), TZ)).toBe('2026-11-10');
    expect(dateKeyOf(sp(2026, 11, 11, 4, 0), TZ)).toBe('2026-11-11');
  });
  it('respeita o fuso do usuário', () => {
    const ts = Date.UTC(2026, 10, 10, 20, 0); // 17h em SP, 05h do dia 11 em Tóquio
    expect(dateKeyOf(ts, 'America/Sao_Paulo')).toBe('2026-11-10');
    expect(dateKeyOf(ts, 'Asia/Tokyo')).toBe('2026-11-11');
  });
  it('período pela hora local', () => {
    expect(periodOf(sp(2026, 11, 10, 8), TZ)).toBe('manha');
    expect(periodOf(sp(2026, 11, 10, 12), TZ)).toBe('tarde');
    expect(periodOf(sp(2026, 11, 10, 18), TZ)).toBe('noite');
    expect(periodOf(sp(2026, 11, 10, 2), TZ)).toBe('noite');
  });
  it('datas e semana (segunda a domingo)', () => {
    expect(weekdayOf('2026-11-23')).toBe(0); // segunda
    expect(weekdayOf('2026-11-29')).toBe(6);
    expect(weekStartOf('2026-11-29')).toBe('2026-11-23');
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('início do dia lógico', () => {
    expect(dateKeyOf(startOfLogicalDay('2026-11-10', TZ), TZ)).toBe('2026-11-10');
    expect(dateKeyOf(startOfLogicalDay('2026-11-10', TZ) - 1, TZ)).toBe('2026-11-09');
  });
});

describe('dia de cuidado', () => {
  it('sessão concluída às 23:50 conta no dia; às 03:30 conta no anterior', () => {
    const a = endedSession(sp(2026, 11, 10, 23, 25), 25, 'concluida'); // termina 23:50
    const b = endedSession(sp(2026, 11, 11, 3, 5), 25, 'concluida'); // termina 03:30
    expect(careDayKeys([a], [], TZ)).toEqual(['2026-11-10']);
    expect(careDayKeys([b], [], TZ)).toEqual(['2026-11-10']);
  });
  it('descanso sozinho é dia de cuidado', () => {
    expect(countCareDays([], [{ date: '2026-11-10' }], TZ)).toBe(1);
  });
  it('interrompida com menos de 50% não conta; com 50% ou mais conta', () => {
    expect(sessionCountsAsCare(endedSession(0, 20, 'interrompida', 9))).toBe(false);
    expect(sessionCountsAsCare(endedSession(0, 20, 'interrompida', 10))).toBe(true);
    expect(sessionCountsAsCare(endedSession(0, 25, 'interrompida', 12))).toBe(false);
    expect(sessionCountsAsCare(endedSession(0, 25, 'interrompida', 13))).toBe(true);
  });
  it('tempo pausado não conta como esforço', () => {
    const s = endedSession(0, 20, 'interrompida', 8, 30 * 60_000);
    expect(sessionCountsAsCare(s)).toBe(false);
  });
  it('em andamento não conta', () => {
    const s: FocusSession = { id: 'x', startedAt: 0, plannedMinutes: 25, state: 'em_andamento', pausedMs: 0 };
    expect(sessionCountsAsCare(s)).toBe(false);
  });
  it('dois eventos no mesmo dia lógico contam uma vez', () => {
    const a = endedSession(sp(2026, 11, 10, 9), 25, 'concluida');
    const b = endedSession(sp(2026, 11, 10, 15), 25, 'concluida');
    expect(countCareDays([a, b], [{ date: '2026-11-10' }], TZ)).toBe(1);
  });
});

function careSessions(days: number, startDay = 1): FocusSession[] {
  return Array.from({ length: days }, (_, i) => endedSession(sp(2026, 10, startDay + i, 10), 25, 'concluida'));
}

describe('fases do sapo', () => {
  it('1 para 2 no terceiro dia e para 3 no oitavo, 4 no décimo quinto', () => {
    expect(phaseForCareDays(0)).toBe(1);
    expect(phaseForCareDays(PHASE_MIN_CARE_DAYS[2] - 1)).toBe(1);
    expect(phaseForCareDays(3)).toBe(2);
    expect(phaseForCareDays(7)).toBe(2);
    expect(phaseForCareDays(8)).toBe(3);
    expect(phaseForCareDays(14)).toBe(3);
    expect(phaseForCareDays(15)).toBe(4);
  });
  it('nunca regride: max do guardado e do calculado', () => {
    expect(resolvePhase(3, 1)).toBe(3);
    expect(resolvePhase(null, 2)).toBe(2);
    const prev = { phase: 3 as const, careDays: 9, updatedAt: 0 };
    const state = computeMascotState([], [], TZ, prev, sp(2026, 12, 20));
    expect(state.phase).toBe(3);
    expect(state.careDays).toBe(9);
  });
  it('não regride depois de 30 dias parado, mesmo sem sessões', async () => {
    const repo = createMemoryRepository();
    for (const s of careSessions(8)) await repo.saveSession(s);
    const first = await refreshMascotState(repo, TZ, sp(2026, 10, 9));
    expect(first.state.phase).toBe(3);
    const later = await refreshMascotState(repo, TZ, sp(2026, 11, 20));
    expect(later.state.phase).toBe(3);
    expect(later.phaseChanged).toBe(false);
  });
  it('com o relógio avançando 15 dias de dados sintéticos o sapo chega à fase 4', async () => {
    const repo = createMemoryRepository();
    let phase = 1;
    for (let d = 0; d < 15; d += 1) {
      await repo.saveSession(endedSession(sp(2026, 11, 1 + d, 10), 25, 'concluida'));
      const r = await refreshMascotState(repo, TZ, sp(2026, 11, 1 + d, 11));
      expect(r.state.phase).toBeGreaterThanOrEqual(phase);
      phase = r.state.phase;
    }
    expect(phase).toBe(4);
  });
  it('marco: phaseChanged na virada', async () => {
    const repo = createMemoryRepository();
    for (const s of careSessions(2)) await repo.saveSession(s);
    expect((await refreshMascotState(repo, TZ, 1)).phaseChanged).toBe(false);
    await repo.saveSession(careSessions(1, 20)[0]);
    const r = await refreshMascotState(repo, TZ, 2);
    expect(r.phaseChanged).toBe(true);
    expect(r.state.phase).toBe(2);
  });
});

describe('resumo da semana', () => {
  // semana de 2026-11-09 (segunda) a 2026-11-15
  const rest = (d: number): RestDay => ({ date: `2026-11-${String(d).padStart(2, '0')}` });
  it('agrega minutos por período e sessões', () => {
    const sessions = [
      endedSession(sp(2026, 11, 9, 9), 25, 'concluida'),
      endedSession(sp(2026, 11, 9, 10), 30, 'concluida', 30),
      endedSession(sp(2026, 11, 10, 14), 25, 'interrompida', 10),
      endedSession(sp(2026, 11, 16, 9), 25, 'concluida'), // outra semana
    ];
    const s = buildWeekSummary({
      weekStart: '2026-11-09',
      timeZone: TZ,
      sessions,
      restDays: [rest(12)],
    });
    expect(s.weekEnd).toBe('2026-11-15');
    expect(s.focusMinutesByPeriod).toEqual({ manha: 55, tarde: 10, noite: 0 });
    expect(s.sessionsByPeriod.manha).toEqual({ completed: 2, interrupted: 0, completionRate: 1 });
    expect(s.sessionsByPeriod.tarde).toEqual({ completed: 0, interrupted: 1, completionRate: 0 });
    expect(s.sessionsByPeriod.noite.completionRate).toBeNull();
    expect(s.totalSessions).toBe(3);
    expect(s.restDays).toBe(1);
    expect(s.careDays).toBe(2); // 9 (concluídas) e 12 (descanso); a de 10 foi <50%
    expect(s.daysWithRecord).toBe(3);
  });
  it('não inclui texto livre: só números, nulos, datas e o período', () => {
    const s = buildWeekSummary({
      weekStart: '2026-11-09',
      timeZone: TZ,
      sessions: [endedSession(sp(2026, 11, 9, 9), 25, 'concluida')],
      restDays: [],
    });
    const strings: string[] = [];
    JSON.stringify(s, (_k, v) => {
      if (typeof v === 'string') strings.push(v);
      return v;
    });
    expect(strings.sort()).toEqual(['2026-11-09', '2026-11-15', 'manha']);
  });
  it('5 dias de cuidado é estável, 4 não', () => {
    const mk = (n: number) =>
      buildWeekSummary({
        weekStart: '2026-11-09',
        timeZone: TZ,
        sessions: Array.from({ length: n }, (_, i) => endedSession(sp(2026, 11, 9 + i, 9), 25, 'concluida')),
        restDays: [],
      });
    expect(STABLE_WEEK_MIN_CARE_DAYS).toBe(5);
    expect(mk(5).stable).toBe(true);
    expect(mk(4).stable).toBe(false);
  });
  it('loadWeekSummary lê do repositório e aceita qualquer data da semana', async () => {
    const repo = createMemoryRepository();
    await repo.saveSession(endedSession(sp(2026, 11, 11, 9), 25, 'concluida'));
    await repo.saveRestDay(rest(13));
    const s = await loadWeekSummary(repo, '2026-11-14', TZ);
    expect(s.weekStart).toBe('2026-11-09');
    expect(s.careDays).toBe(2);
  });
});
