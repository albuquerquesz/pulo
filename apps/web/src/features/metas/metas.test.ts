import { createMemoryRepository } from '@/data';
import { fixedClock } from '@pulo/core/domain/clock';
import { concluirMeta, criarMeta } from '@pulo/core/domain/goals';
import { sp } from '@pulo/core/domain/test-utils';
import type { Goal, Habit } from '@pulo/core/domain/types';

import { concluirOnboarding } from '../app/core';
import {
  carregarMetas,
  dataCurta,
  habitosSoltos,
  marcosDoTexto,
  posicaoDoRitmo,
  semanaDoHabito,
  seloDoRitmo,
  textoDaData,
  textoDosDias,
} from './logic';

const HOJE = '2026-11-23';
const FUSO = 'America/Sao_Paulo';
const meta = (extra: Partial<Goal> = {}): Goal => ({ id: 'g', title: 'x', state: 'ativa', milestones: [], createdAt: 1, ...extra });

describe('Metas', () => {
  test('ordena em andamento por prazo, concluídas pela mais recente e diz se cabe mais uma', async () => {
    const repo = createMemoryRepository();
    const clock = fixedClock(sp(2026, 11, 23, 10, 0));
    const user = await concluirOnboarding(repo, clock, { frogName: 'Juca', startHour: 7, endHour: 22 });
    const ids: string[] = [];
    for (const [title, targetDate] of [['sem data', undefined], ['perto', '2026-12-01'], ['longe', '2027-06-01']] as const) {
      const r = await criarMeta(repo, { title, targetDate }, clock.now(), HOJE);
      if (r.ok) ids.push(r.value.id);
    }
    let d = await carregarMetas(repo, clock, user);
    expect(d.hoje).toBe(HOJE);
    expect(d.ativas.map((g) => g.title)).toEqual(['perto', 'longe', 'sem data']);
    expect(d.cabeMais).toBe(false);

    await concluirMeta(repo, ids[1], clock.now() - 1000);
    await concluirMeta(repo, ids[2], clock.now());
    d = await carregarMetas(repo, clock, user);
    expect(d.concluidas.map((g) => g.title)).toEqual(['longe', 'perto']);
    expect(d.cabeMais).toBe(true);
  });

  test('a linha de ritmo só aparece em andamento e com data', () => {
    expect(posicaoDoRitmo({ esperado: 0.524, atual: 0.6, estado: 'no-ritmo' })).toBe(52);
    expect(posicaoDoRitmo({ esperado: 1, atual: 0, estado: 'atras' })).toBe(100);
    expect(posicaoDoRitmo({ esperado: 1, atual: 1, estado: 'concluida' })).toBeUndefined();
    expect(posicaoDoRitmo({ esperado: 0, atual: 0, estado: 'sem-data' })).toBeUndefined();
  });

  test('texto do selo', () => {
    expect(seloDoRitmo('no-ritmo')).toEqual({ texto: 'No ritmo', tom: 'bom' });
    expect(seloDoRitmo('atras')).toEqual({ texto: 'Um pouco atrás', tom: 'atras' });
    expect(seloDoRitmo('concluida')).toEqual({ texto: 'Concluída', tom: 'bom' });
    expect(seloDoRitmo('sem-data')).toBeNull();
  });

  test('datas e dias restantes', () => {
    expect(textoDaData(meta({ targetDate: '2027-06-30' }), HOJE, FUSO)).toBe('até 30 de junho');
    expect(textoDaData(meta({ targetDate: '2028-06-30' }), HOJE, FUSO)).toBe('até 30 de junho de 2028');
    expect(textoDaData(meta(), HOJE, FUSO)).toBe('sem data');
    expect(textoDaData(meta({ state: 'concluida', completedAt: sp(2026, 11, 18, 10, 0) }), HOJE, FUSO)).toBe('concluída em 18 de novembro');
    expect(dataCurta(sp(2026, 9, 12, 10, 0), FUSO)).toBe('12 set');
    expect(textoDosDias(meta(), 26)).toBe('26');
    expect(textoDosDias(meta(), 0)).toBe('—');
    expect(textoDosDias(meta(), null)).toBe('—');
    expect(textoDosDias(meta({ state: 'concluida' }), 10)).toBe('—');
  });

  test('semana do hábito, hábitos soltos e marcos do texto', () => {
    // 23/11/2026 é segunda.
    expect(semanaDoHabito('h', [{ habitId: 'h', date: '2026-11-24', doneAt: 1 }, { habitId: 'h', date: '2026-11-22', doneAt: 1 }], HOJE)).toEqual([
      false, true, false, false, false, false, false,
    ]);
    const h = (id: string, extra: Partial<Habit> = {}): Habit => ({ id, title: id, weekdays: [0], state: 'ativo', ...extra });
    expect(habitosSoltos([h('a'), h('b', { goalId: 'g' }), h('c', { state: 'arquivado' }), h('d', { state: 'pausado' })]).map((x) => x.id)).toEqual(['a', 'd']);
    expect(marcosDoTexto(' 5 km \n\n10 km\n  ')).toEqual(['5 km', '10 km']);
  });
});
