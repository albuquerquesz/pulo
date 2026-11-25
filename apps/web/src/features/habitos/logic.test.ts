import { habitsForDate } from '@pulo/core/domain/habits';
import type { Habit, HabitStats } from '@pulo/core/domain/types';

import { criarSessaoDemo } from '../app/demo';
import {
  agruparPorPeriodo,
  alternarDia,
  carregarEstatisticas,
  lerBuscaDeHabitos,
  lerCampoDeHora,
  linhasDoCalendario,
  paraCampoDeHora,
  textoDaFrequencia,
  textoDaTaxa,
} from './logic';

const habito = (id: string, extra: Partial<Habit> = {}): Habit => ({ id, title: id, weekdays: [0], state: 'ativo', ...extra });
const ids = (habitos: Habit[]) => habitos.map((h) => h.id);

describe('texto da frequência', () => {
  test('todo dia, seg a sex e dias soltos', () => {
    expect(textoDaFrequencia([0, 1, 2, 3, 4, 5, 6])).toBe('todo dia');
    expect(textoDaFrequencia([4, 3, 2, 1, 0])).toBe('seg a sex');
    expect(textoDaFrequencia([0, 2, 4])).toBe('seg, qua, sex');
    expect(textoDaFrequencia([0, 1, 2, 3, 5])).toBe('seg, ter, qua, qui, sáb');
  });
});

describe('agrupamento por período', () => {
  test('os três períodos sempre aparecem, na ordem do dia', () => {
    const grupos = agruparPorPeriodo([habito('n', { period: 'noite' }), habito('m', { period: 'manha' })]);
    expect(grupos.map((g) => [g.titulo, ids(g.habitos)])).toEqual([
      ['☀️ Manhã', ['m']],
      ['🌤️ Tarde', []],
      ['🌙 Noite', ['n']],
    ]);
  });

  test('sem período e pausados ganham grupo próprio; arquivados somem', () => {
    const grupos = agruparPorPeriodo([
      habito('solto'),
      habito('parado', { period: 'manha', state: 'pausado' }),
      habito('largado', { state: 'arquivado' }),
    ]);
    expect(grupos.slice(3).map((g) => [g.chave, ids(g.habitos)])).toEqual([
      ['sem_periodo', ['solto']],
      ['pausados', ['parado']],
    ]);
    expect(grupos.flatMap((g) => ids(g.habitos))).not.toContain('largado');
  });
});

test('dias, taxa, hora e busca', () => {
  expect(alternarDia([0, 4], 2)).toEqual([0, 2, 4]);
  expect(alternarDia([0, 4], 4)).toEqual([0]);
  expect(textoDaTaxa(0.857)).toBe('86%');
  expect(textoDaTaxa(null)).toBe('—');
  expect(paraCampoDeHora(450)).toBe('07:30');
  expect(lerCampoDeHora('07:30')).toBe(450);
  expect(lerCampoDeHora('')).toBeNull();
  expect(lerBuscaDeHabitos({ habito: 'a' })).toEqual({ habito: 'a' });
  expect(lerBuscaDeHabitos({ habito: 3 })).toEqual({});
});

test('o calendário vira uma linha por dia da semana, com hoje marcado', () => {
  const semana = (datas: string[]): HabitStats['calendario'][number] =>
    datas.map((date) => ({ date, estado: date > '2026-11-17' ? 'futuro' : 'vazio' }));
  const calendario: HabitStats['calendario'] = [semana(['2026-11-08', '2026-11-09']), semana(['2026-11-15', '2026-11-17', '2026-11-18'])];
  const linhas = linhasDoCalendario(calendario);
  expect(linhas.map((l) => l.letra)).toEqual(['', 'S']);
  expect(linhas[1]?.dias.map((d) => [d.date, d.hoje])).toEqual([
    ['2026-11-09', false],
    ['2026-11-17', true],
  ]);
});

test('o demo traz o histórico do rascunho sem mexer nos registros', async () => {
  const { repo, clock } = await criarSessaoDemo();
  const antes = (await repo.listHabitLogs()).length;
  const stats = await carregarEstatisticas(repo, clock);
  expect(stats.get('demo-habito-ingles')?.sequencia).toBe(8);
  expect(stats.get('demo-habito-ler')?.sequencia).toBe(3);
  expect(stats.get('demo-habito-ingles')?.calendario).toHaveLength(16);
  expect((await repo.listHabitLogs()).length).toBe(antes);
  expect(habitsForDate(await repo.listHabits(), '2026-11-21')).toHaveLength(4);
});
