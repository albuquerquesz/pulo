import type { FocusSession, Habit, HabitLog } from '@pulo/core/domain/types';

import { focoDoIntervalo, habitosDoIntervalo, type RegistrosDoRitmo } from './series';

const FUSO = 'America/Sao_Paulo';
/** Hora de São Paulo (UTC-3). */
const sp = (dia: string, hora = 12) => Date.parse(`${dia}T${String(hora).padStart(2, '0')}:00:00-03:00`);

function foco(dia: string, hora: number, minutos: number, extra: Partial<FocusSession> = {}): FocusSession {
  const startedAt = sp(dia, hora);
  return { id: `${dia}-${hora}`, startedAt, endedAt: startedAt + minutos * 60_000, plannedMinutes: minutos, state: 'concluida', pausedMs: 0, ...extra };
}

const HABITO: Habit = { id: 'agua', title: 'Água', weekdays: [0, 1, 2, 3, 4, 5, 6], state: 'ativo' };
const feito = (date: string): HabitLog => ({ habitId: HABITO.id, date, doneAt: sp(date) });

/** Quinta, 26 de novembro de 2026. */
const BASE: RegistrosDoRitmo = {
  sessions: [],
  habits: [],
  habitLogs: [],
  restDays: [],
  user: { createdAt: sp('2026-01-01'), timezone: FUSO, dayStartMinutes: 240 },
  now: sp('2026-11-26', 20),
};

describe('séries do ritmo', () => {
  test('sem registros os gráficos vêm zerados', () => {
    expect(focoDoIntervalo(BASE).porDia.colunas.every((c) => c.altura === 0)).toBe(true);
    expect(habitosDoIntervalo(BASE).serie.colunas.every((c) => c.altura === 0)).toBe(true);
    expect(habitosDoIntervalo(BASE).taxa).toBeNull();
  });

  test('foco por dia na janela, com hoje destacado e o eixo redondo', () => {
    const sessions = [
      foco('2026-11-26', 9, 25),
      foco('2026-11-26', 14, 50),
      foco('2026-10-28', 9, 30),
      foco('2026-10-27', 9, 60),
      foco('2026-11-25', 9, 40, { state: 'em_andamento', endedAt: undefined }),
    ];
    const serie = focoDoIntervalo({ ...BASE, sessions }).porDia;
    expect(serie.colunas).toHaveLength(30);
    expect(serie.eixo).toEqual(['1h30', '45 min', '0']);
    expect(serie.colunas[0]).toMatchObject({ chave: '2026-10-28', texto: '30 min', altura: 33, destaque: false });
    expect(serie.colunas[28]).toMatchObject({ texto: '0 min', altura: 0, rotulo: '' });
    expect(serie.colunas[29]).toMatchObject({ rotulo: 'hoje', texto: '1h15', altura: 83, destaque: true });
  });

  test('a madrugada fica no dia anterior', () => {
    const series = focoDoIntervalo({ ...BASE, sessions: [foco('2026-11-26', 1, 30)] });
    expect(series.porDia.colunas.at(-2)?.texto).toBe('30 min');
  });

  test('conta nova só mostra os dias desde a criação', () => {
    const user = { ...BASE.user, createdAt: sp('2026-11-24') };
    const series = focoDoIntervalo({ ...BASE, user, sessions: [foco('2026-11-24', 9, 10)] });
    expect(series.porDia.colunas.map((c) => c.chave)).toEqual(['2026-11-24', '2026-11-25', '2026-11-26']);
  });

  test('hábitos por semana: descanso, férias e hoje em aberto ficam fora', () => {
    const registros: RegistrosDoRitmo = {
      ...BASE,
      habits: [HABITO],
      habitLogs: [feito('2026-11-16'), feito('2026-11-17'), feito('2026-11-23')],
      restDays: [{ date: '2026-11-18' }],
      vacation: { ligado: false, desde: null, periodos: [{ de: '2026-11-19', ate: '2026-11-20' }] },
    };
    const colunas = habitosDoIntervalo(registros).serie.colunas;
    expect(colunas?.at(-2)).toMatchObject({ rotulo: '16/11', texto: '50%', altura: 50 });
    expect(colunas?.at(-1)).toMatchObject({ rotulo: '23/11', texto: '33%', destaque: true });
    expect(colunas?.[0]?.texto).toBe('sem hábitos na conta');
  });

  test('o intervalo muda a janela e os números do foco', () => {
    const sessions = [foco('2026-11-26', 9, 30), foco('2026-11-25', 15, 60), foco('2026-11-10', 9, 90)];
    const hoje = focoDoIntervalo({ ...BASE, sessions }, 1);
    expect(hoje.porDia.colunas).toHaveLength(1);
    expect(hoje).toMatchObject({ medioPorDia: 30, sessoesTerminadas: 1, melhorPeriodo: 'manha' });
    const semana = focoDoIntervalo({ ...BASE, sessions }, 7);
    expect(semana.porDia.colunas).toHaveLength(7);
    expect(semana.porDia.colunas.every((c) => c.rotulo !== '')).toBe(true);
    expect(semana).toMatchObject({ medioPorDia: 13, sessoesTerminadas: 2, melhorPeriodo: 'tarde' });
  });

  test('até uma semana os hábitos vão por dia, e a taxa soma o intervalo', () => {
    const registros: RegistrosDoRitmo = { ...BASE, habits: [HABITO], habitLogs: [feito('2026-11-20'), feito('2026-11-24'), feito('2026-11-26')] };
    const semana = habitosDoIntervalo(registros, 7);
    expect(semana.serie.colunas).toHaveLength(7);
    expect(semana.serie.colunas.at(-1)).toMatchObject({ rotulo: 'hoje', texto: '100%', destaque: true });
    expect(semana.taxa).toBeCloseTo(3 / 7);
  });
});
