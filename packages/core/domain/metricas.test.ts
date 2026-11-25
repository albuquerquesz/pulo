import { createMemoryRepository } from '../data/memory-repository';
import { createDemoClock, seedRepository } from '../demo';
import { type MetricsInput, computeMetrics, verMetricas } from './metricas';
import { TZ, endedSession, sp } from './test-utils';

/** Quarta, 18/11/2026, meio dia em São Paulo. */
const NOW = sp(2026, 11, 18);
const metrics = (extra: Partial<MetricsInput> = {}) =>
  computeMetrics({
    habits: [],
    habitLogs: [],
    sessions: [],
    restDays: [],
    gelo: { usadosTotal: 0, guardados: 1 },
    feitos: { tarefasConcluidas: 0, metasConcluidas: 0, joiasGanhas: 0 },
    createdAt: sp(2026, 9, 1),
    timeZone: TZ,
    dayStartMinutes: 240,
    now: NOW,
    ...extra,
  });
const focus = (month: number, day: number, minutes = 30, hour = 9) => endedSession(sp(2026, month, day, hour), minutes, 'concluida');

describe('métricas', () => {
  it('sem história: zeros e nulos', () => {
    expect(metrics()).toMatchObject({
      descanso: { total: 0, noMes: 0, semanasComDescanso: 0, focoMedioSemanaComDescanso: null, focoMedioSemanaSem: null },
      ritmo: { focoMedioPorDia30: 0, taxaHabitos30: null, melhorPeriodo: null, melhorDiaDaSemana: null, sessoesTerminadas: 0 },
    });
  });

  it('a média usa só os dias desde a criação da conta, até 30', () => {
    const sessions = [focus(11, 17, 60), focus(9, 1, 50)];
    expect(metrics({ sessions }).ritmo.focoMedioPorDia30).toBe(2);
    expect(metrics({ sessions, createdAt: sp(2026, 11, 16) }).ritmo).toMatchObject({ focoMedioPorDia30: 20, sessoesTerminadas: 1 });
  });

  it('taxa de hábitos: dias da frequência, sem descanso e sem hoje vazio', () => {
    const habits = [{ id: 'h', weekdays: [0, 1, 2, 3, 4, 5, 6] as const, state: 'ativo' as const }].map((h) => ({ ...h, weekdays: [...h.weekdays] }));
    const habitLogs = [{ habitId: 'h', date: '2026-11-14' }, { habitId: 'h', date: '2026-11-17' }];
    const result = metrics({ habits, habitLogs, restDays: [{ date: '2026-11-15' }] });
    // Contam 14 (feito), 16 (vazio) e 17 (feito).
    expect(result.ritmo.taxaHabitos30).toBeCloseTo(2 / 3);
  });

  it('melhor período e melhor dia; no empate, o dia mais recente', () => {
    const sessions = [focus(11, 9, 30, 14), focus(11, 17, 30, 14), focus(11, 11, 20, 9)];
    expect(metrics({ sessions }).ritmo).toMatchObject({ melhorPeriodo: 'tarde', melhorDiaDaSemana: 1 });
    const empate = [focus(11, 9, 30), focus(11, 17, 30)];
    expect(metrics({ sessions: empate }).ritmo.melhorDiaDaSemana).toBe(1);
  });

  it('compara semanas com e sem descanso só com duas de cada tipo', () => {
    const restDays = [{ date: '2026-10-20' }, { date: '2026-10-27' }];
    const sessions = [focus(10, 19, 50), focus(10, 26, 40), focus(11, 2, 20)];
    expect(metrics({ restDays, sessions }).descanso).toMatchObject({ total: 2, noMes: 0, semanasComDescanso: 2, focoMedioSemanaComDescanso: null });
    expect(metrics({ restDays, sessions: [...sessions, focus(11, 9, 30)] }).descanso).toMatchObject({
      focoMedioSemanaComDescanso: 45,
      focoMedioSemanaSem: 25,
    });
  });

  it('no demo há números de exemplo', async () => {
    const repo = createMemoryRepository();
    const clock = createDemoClock();
    await seedRepository(repo, clock);
    const result = await verMetricas(repo, clock);
    expect(result?.gelo.usadosTotal).toBe(1);
    expect(result?.ritmo.focoMedioPorDia30).toBeGreaterThan(0);
    expect(result?.ritmo.melhorPeriodo).toBe('manha');
    expect(result?.feitos.joiasGanhas).toBeGreaterThan(0);
  });
});
