import { createMemoryRepository } from '@/data';
import { fixedClock } from '@pulo/core/domain/clock';
import { concluirMeta, criarMeta } from '@pulo/core/domain/goals';
import { sp } from '@pulo/core/domain/test-utils';
import type { Goal } from '@pulo/core/domain/types';

import { concluirOnboarding } from '../app/core';
import { carregarMetas, dataPorExtenso, marcosDoTexto, textoDoPrazo } from './logic';

const HOJE = '2026-11-23';
const meta = (targetDate?: string): Goal => ({ id: 'g', title: 'x', state: 'ativa', milestones: [], createdAt: 1, ...(targetDate ? { targetDate } : {}) });

describe('Metas', () => {
  test('carrega ativas e concluídas separadas e diz se cabe mais uma', async () => {
    const repo = createMemoryRepository();
    const clock = fixedClock(sp(2026, 11, 23, 10, 0));
    const user = await concluirOnboarding(repo, clock, { frogName: 'Juca', startHour: 7, endHour: 22 });
    const ids: string[] = [];
    for (const title of ['a', 'b', 'c']) {
      const r = await criarMeta(repo, { title }, clock.now(), HOJE);
      if (r.ok) ids.push(r.value.id);
    }
    let d = await carregarMetas(repo, clock, user);
    expect(d.hoje).toBe(HOJE);
    expect(d.ativas).toHaveLength(3);
    expect(d.cabeMais).toBe(false);

    await concluirMeta(repo, ids[1], clock.now());
    d = await carregarMetas(repo, clock, user);
    expect(d.ativas.map((g) => g.title)).toEqual(['a', 'c']);
    expect(d.concluidas.map((g) => g.title)).toEqual(['b']);
    expect(d.cabeMais).toBe(true);
  });

  test('prazo em dias, meses ou anos', () => {
    expect(textoDoPrazo(meta(), HOJE)).toBeNull();
    expect(textoDoPrazo(meta('2026-11-23'), HOJE)).toBe('O prazo é hoje');
    expect(textoDoPrazo(meta('2026-11-24'), HOJE)).toBe('Falta 1 dia');
    expect(textoDoPrazo(meta('2026-12-20'), HOJE)).toBe('Faltam 27 dias');
    expect(textoDoPrazo(meta('2027-06-01'), HOJE)).toBe('Faltam 6 meses');
    expect(textoDoPrazo(meta('2029-12-01'), HOJE)).toBe('Faltam 3 anos');
    expect(textoDoPrazo(meta('2026-11-20'), HOJE)).toBe('O prazo passou há 3 dias');
  });

  test('data por extenso e marcos do texto', () => {
    expect(dataPorExtenso('2027-06-01')).toBe('1 de junho de 2027');
    expect(marcosDoTexto(' 5 km \n\n10 km\n  ')).toEqual(['5 km', '10 km']);
  });
});
