import { createDemoClock, seedRepository } from '../demo';
import { createMemoryRepository } from '../data/memory-repository';
import { computeStreak, type StreakInput, verSequencia } from './streak';
import { TZ, endedSession, sp } from './test-utils';

/** Quarta, 18/11/2026, meio dia em São Paulo. */
const NOW = sp(2026, 11, 18);

const days = (...n: number[]) => n.map((d) => ({ date: `2026-11-${String(d).padStart(2, '0')}` }));

const streak = (extra: Partial<StreakInput> = {}) =>
  computeStreak({ habitLogs: [], sessions: [], restDays: [], timeZone: TZ, dayStartMinutes: 240, now: NOW, ...extra });

const states = (extra: Partial<StreakInput>) => streak(extra).semana.map((d) => d.estado);

describe('computeStreak', () => {
  it('histórico vazio: zero, semana de domingo a sábado', () => {
    const result = streak();
    expect(result).toMatchObject({ atual: 0, recorde: 0 });
    expect(result.semana[0].date).toBe('2026-11-15');
    expect(result.semana[6].date).toBe('2026-11-21');
    expect(result.semana.map((d) => d.estado)).toEqual(['vazio', 'vazio', 'vazio', 'hoje', 'futuro', 'futuro', 'futuro']);
  });

  it('sequência simples com hábito e foco, sem contar o mesmo dia duas vezes', () => {
    const result = streak({ habitLogs: days(16, 16, 18), sessions: [endedSession(sp(2026, 11, 17), 25, 'concluida')] });
    expect(result).toMatchObject({ atual: 3, recorde: 3 });
    expect(result.semana.slice(0, 4).map((d) => d.estado)).toEqual(['vazio', 'feito', 'feito', 'feito']);
  });

  it('férias contam como descanso: as atuais até hoje e as já encerradas', () => {
    const habitLogs = days(13, 18);
    const periodos = [{ de: '2026-11-14', ate: '2026-11-15' }];
    expect(streak({ habitLogs, vacation: { ligado: true, desde: '2026-11-16', periodos } })).toMatchObject({ atual: 2, recorde: 2 });
    const extra: Partial<StreakInput> = { habitLogs: days(16), vacation: { ligado: true, desde: '2026-11-17', periodos: [] } };
    expect(streak(extra).atual).toBe(1);
    expect(states(extra).slice(1)).toEqual(['feito', 'descanso', 'descanso', 'futuro', 'futuro', 'futuro']);
    expect(streak({ habitLogs: days(16), vacation: { ligado: false, desde: null, periodos: [] } }).atual).toBe(0);
  });

  it('sessão interrompida cedo não conta', () => {
    expect(streak({ sessions: [endedSession(sp(2026, 11, 18, 9), 30, 'interrompida', 5)] }).atual).toBe(0);
  });

  it('dia protegido por gelo mantém a chama sem somar e aparece como gelo', () => {
    const extra = { habitLogs: days(15, 17), freezes: ['2026-11-16'] };
    expect(streak(extra)).toMatchObject({ atual: 2, recorde: 2 });
    expect(states(extra).slice(0, 4)).toEqual(['feito', 'gelo', 'feito', 'hoje']);
  });

  it('descanso no meio não quebra nem soma', () => {
    const extra = { habitLogs: days(15, 17), restDays: days(16, 18) };
    expect(streak(extra)).toMatchObject({ atual: 2, recorde: 2 });
    expect(states(extra).slice(0, 4)).toEqual(['feito', 'descanso', 'feito', 'descanso']);
  });

  it('só descanso não soma, e feito vence descanso no mesmo dia', () => {
    expect(streak({ restDays: days(16, 17, 18) })).toMatchObject({ atual: 0, recorde: 0 });
    expect(states({ habitLogs: days(18), restDays: days(18) })[3]).toBe('feito');
  });

  it('hoje vazio não zera; um dia inteiro vazio zera', () => {
    expect(streak({ habitLogs: days(16, 17) }).atual).toBe(2);
    expect(streak({ habitLogs: days(15, 16) }).atual).toBe(0);
  });

  it('recorde maior que a atual', () => {
    expect(streak({ habitLogs: days(1, 2, 3, 4, 17, 18) })).toMatchObject({ atual: 2, recorde: 4 });
  });

  it('virada às 4h: foco de madrugada conta no dia anterior', () => {
    const sessions = [endedSession(sp(2026, 11, 18, 1), 25, 'concluida')];
    expect(states({ sessions }).slice(2, 4)).toEqual(['feito', 'hoje']);
  });

  it('vira no começo do dia da pessoa', () => {
    const sessions = [endedSession(sp(2026, 11, 18, 8), 25, 'concluida')];
    expect(states({ sessions, dayStartMinutes: 600, now: sp(2026, 11, 18, 9) }).slice(2, 4)).toEqual(['feito', 'futuro']);
    expect(states({ sessions, dayStartMinutes: 600 }).slice(2, 4)).toEqual(['feito', 'hoje']);
  });

  it('antes do começo do dia, ontem vazio ainda não zera', () => {
    expect(streak({ habitLogs: days(16), dayStartMinutes: 420, now: sp(2026, 11, 18, 5) }).atual).toBe(1);
  });

  it('hábito marcado entre a virada do app e o começo do dia aparece na hora', () => {
    const extra = { habitLogs: days(17, 18), dayStartMinutes: 420, now: sp(2026, 11, 18, 5) };
    expect(streak(extra).atual).toBe(2);
    expect(states(extra)[3]).toBe('feito');
  });

  it('registro em dia futuro não conta', () => {
    expect(streak({ habitLogs: days(19, 20) })).toMatchObject({ atual: 0, recorde: 0 });
  });

  it('usa o fuso da pessoa', () => {
    // 18/11 às 02h em São Paulo já é 18/11 às 14h em Tóquio.
    const extra = { sessions: [endedSession(sp(2026, 11, 18, 1), 25, 'concluida')], now: sp(2026, 11, 18, 2) };
    expect(streak(extra).semana.find((d) => d.estado === 'feito')?.date).toBe('2026-11-17');
    expect(streak({ ...extra, timeZone: 'Asia/Tokyo' }).semana.find((d) => d.estado === 'feito')?.date).toBe('2026-11-18');
  });

  it('o modo demo tem uma sequência de exemplo', async () => {
    const clock = createDemoClock();
    const repo = createMemoryRepository();
    await seedRepository(repo, clock);
    const result = await verSequencia(repo, clock);
    expect(result.atual).toBeGreaterThan(0);
    expect(result.recorde).toBeGreaterThanOrEqual(result.atual);
  });
});
