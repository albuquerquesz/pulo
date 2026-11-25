import { ACHIEVEMENTS } from '../config/decisions';
import { createDemoClock, seedRepository } from '../demo';
import { createMemoryRepository } from '../data/memory-repository';
import { type AchievementSources, computeAchievements, passingAchievements, summarizeForAchievements, verConquistas } from './achievements';
import { endedSession, sp } from './test-utils';
import type { AchievementId, Purchase } from './types';

const parts = (...items: string[]): Purchase[] => items.map((item) => ({ item, cost: 1, createdAt: 1 }));
const summary = (extra: Partial<AchievementSources> = {}) =>
  summarizeForAchievements({ sequencia: { atual: 0, recorde: 0 }, sessions: [], descansos: 0, casa: [], gelosUsados: 0, ...extra });
const one = (id: AchievementId, extra: Partial<AchievementSources> = {}) =>
  computeAchievements(summary(extra), []).find((item) => item.id === id);
const passes = (id: AchievementId, extra: Partial<AchievementSources>) => passingAchievements(summary(extra)).includes(id);
const run = (atual: number, recorde = atual) => ({ sequencia: { atual, recorde } });

describe('conquistas', () => {
  it('sem registros: o catálogo inteiro, nada conquistado, só a casa com o quarto', () => {
    const all = computeAchievements(summary(), []);
    expect(all.map((item) => item.id)).toEqual(ACHIEVEMENTS.map((item) => item.id));
    expect(all.some((item) => item.conquistada)).toBe(false);
    expect(all.map((item) => item.progresso)).toEqual([0, 0, 0, 0, 1, 0, 0]);
  });

  it.each([
    ['primeira-semana', 7],
    ['mes-de-fogo', 30],
  ] as const)('%s: falta um dia e depois conquista', (id, days) => {
    expect(passes(id, run(days - 1))).toBe(false);
    expect(one(id, run(days - 1))).toMatchObject({ progresso: days - 1, meta: days });
    expect(passes(id, run(days))).toBe(true);
  });

  it('sequência: o progresso é a viva; um recorde antigo já basta', () => {
    expect(one('mes-de-fogo', run(3, 21))).toMatchObject({ progresso: 3 });
    expect(one('primeira-semana', run(0, 9))).toMatchObject({ progresso: 7 });
    expect(passes('primeira-semana', run(0, 9))).toBe(true);
  });

  it('foco profundo: 49 minutos não, 50 sim; pausa não conta e interrompida com 50 vale', () => {
    const at = sp(2026, 11, 18);
    const short = { sessions: [endedSession(at, 50, 'interrompida', 49)] };
    expect(passes('foco-profundo', short)).toBe(false);
    expect(one('foco-profundo', short)).toMatchObject({ progresso: 49, meta: 50 });
    expect(passes('foco-profundo', { sessions: [endedSession(at, 50, 'concluida')] })).toBe(true);
    expect(passes('foco-profundo', { sessions: [endedSession(at, 50, 'interrompida', 50)] })).toBe(true);
    const paused = { ...endedSession(at, 50, 'concluida'), pausedMs: 60_000 };
    expect(passes('foco-profundo', { sessions: [paused] })).toBe(false);
  });

  it('descanso sabido: 3 não, 4 sim', () => {
    expect(passes('descanso-sabido', { descansos: 3 })).toBe(false);
    expect(passes('descanso-sabido', { descansos: 4 })).toBe(true);
  });

  it('gelo na hora certa: o primeiro gelo usado conquista', () => {
    expect(passes('gelo-na-hora', { gelosUsados: 0 })).toBe(false);
    expect(passes('gelo-na-hora', { gelosUsados: 1 })).toBe(true);
  });

  it('casa inteira: precisa de todas as partes', () => {
    const almost = { casa: parts('cozinha', 'varanda', 'jardim', 'arvore') };
    expect(one('casa-inteira', almost)).toMatchObject({ conquistada: false, progresso: 5, meta: 6 });
    expect(passes('casa-inteira', { casa: parts('cozinha', 'varanda', 'jardim', 'arvore', 'cerca') })).toBe(true);
  });

  it('a gravada continua conquistada sem os registros, com a data', () => {
    const all = computeAchievements(summary(), [{ id: 'descanso-sabido', conquistadaEm: 123 }]);
    expect(all.find((item) => item.id === 'descanso-sabido')).toMatchObject({ conquistada: true, conquistadaEm: 123, progresso: 4, meta: 4 });
  });

  it('a secreta vem sem nome nem emoji até ser conquistada, e nenhuma regra a dá', () => {
    const locked = one('segredo', { ...run(99), descansos: 99 });
    expect(locked).toEqual({ id: 'segredo', conquistada: false, progresso: 0, meta: 1 });
    const unlocked = computeAchievements(summary(), [{ id: 'segredo', conquistadaEm: 1 }]).at(-1);
    expect(unlocked).toMatchObject({ nome: 'Segredo', conquistada: true });
  });

  it('modo demo: mostra algumas medalhas de exemplo, calculadas sem data', async () => {
    const repo = createMemoryRepository();
    const clock = createDemoClock();
    await seedRepository(repo, clock);
    const all = await verConquistas(repo, clock);
    expect(all.filter((item) => item.conquistada).length).toBeGreaterThanOrEqual(2);
    expect(all.some((item) => !item.conquistada)).toBe(true);
    expect(all.every((item) => item.conquistadaEm === undefined)).toBe(true);
  });
});
