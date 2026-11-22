import { FROG_EVENT_MS } from '@pulo/core/config/decisions';
import type { FrogInputs, FrogMood, Phase } from '@pulo/core/domain/types';

import {
  ESTADOS_POR_FASE,
  ROSTO_DO_ESTADO,
  ROTULO_DO_ESTADO,
  estadoDoSapo,
  estadoParaFase,
  eventoAtivo,
  rotuloDoSapo,
} from './machine';

const base: FrogInputs = {
  phase: 3,
  latestEnergyToday: null,
  focusRunning: false,
  aiAnalyzing: false,
  activeEvent: null,
  withinUserDay: true,
};

const tabela: [string, Partial<FrogInputs>, FrogMood][] = [
  ['sem nada: parado', {}, 'parado'],
  ['fora do dia: dormindo', { withinUserDay: false }, 'dormindo'],
  ['energia 2: cansado', { latestEnergyToday: 2 }, 'cansado'],
  ['energia 1: cansado', { latestEnergyToday: 1 }, 'cansado'],
  ['energia 3: parado', { latestEnergyToday: 3 }, 'parado'],
  ['energia 5: parado', { latestEnergyToday: 5 }, 'parado'],
  ['cansado vence dormindo', { latestEnergyToday: 1, withinUserDay: false }, 'cansado'],
  ['foco vence cansado', { focusRunning: true, latestEnergyToday: 1 }, 'focado'],
  ['foco vence dormindo', { focusRunning: true, withinUserDay: false }, 'focado'],
  ['IA analisando vence foco', { aiAnalyzing: true, focusRunning: true }, 'pensando'],
  ['feliz vence pensando', { activeEvent: 'feliz', aiAnalyzing: true }, 'feliz'],
  ['feliz vence foco e cansado', { activeEvent: 'feliz', focusRunning: true, latestEnergyToday: 1 }, 'feliz'],
  ['surpreso durante foco', { activeEvent: 'surpreso', focusRunning: true }, 'surpreso'],
  ['pouso vence tudo', { activeEvent: 'pouso', aiAnalyzing: true, focusRunning: true, latestEnergyToday: 1, withinUserDay: false }, 'pouso'],
];

describe('estadoDoSapo', () => {
  test.each(tabela)('%s', (_n, parcial, esperado) => {
    expect(estadoDoSapo({ ...base, ...parcial })).toBe(esperado);
  });

  test('depois que o surpreso acaba, volta ao focado', () => {
    const duracao = FROG_EVENT_MS.surpreso;
    const evento = { tipo: 'surpreso' as const, desde: 1000 };
    const em = (t: number) =>
      estadoDoSapo({ ...base, focusRunning: true, activeEvent: eventoAtivo(evento, t, FROG_EVENT_MS) });
    expect(em(1000 + duracao - 1)).toBe('surpreso');
    expect(em(1000 + duracao)).toBe('focado');
  });

  test('mudança de fase: pouso e depois o estado base', () => {
    const evento = { tipo: 'pouso' as const, desde: 0 };
    const em = (t: number) => estadoDoSapo({ ...base, activeEvent: eventoAtivo(evento, t, FROG_EVENT_MS) });
    expect(em(100)).toBe('pouso');
    expect(em(FROG_EVENT_MS.pouso)).toBe('parado');
  });

  test('eventoAtivo sem evento é null', () => {
    expect(eventoAtivo(null, 5, FROG_EVENT_MS)).toBeNull();
  });
});

describe('fases', () => {
  const todos = Object.keys(ROSTO_DO_ESTADO) as FrogMood[];

  test('fase 1 pedindo surpreso cai para parado', () => {
    expect(estadoParaFase(1, 'surpreso')).toBe('parado');
    expect(estadoParaFase(2, 'focado')).toBe('parado');
    expect(estadoParaFase(1, 'cansado')).toBe('cansado');
    expect(estadoParaFase(2, 'feliz')).toBe('feliz');
  });

  test('fases 3 e 4 têm todos os estados', () => {
    for (const f of [3, 4] as Phase[]) for (const e of todos) expect(estadoParaFase(f, e)).toBe(e);
  });

  test('todo estado tem rosto, rótulo e fase com arte', () => {
    expect(todos).toHaveLength(8);
    for (const e of todos) {
      expect(ROSTO_DO_ESTADO[e]).toBeDefined();
      expect(ROTULO_DO_ESTADO[e].length).toBeGreaterThan(0);
      expect(rotuloDoSapo(e)).toMatch(/^Sapo, /);
      expect(ESTADOS_POR_FASE[4]).toContain(e);
    }
  });
});
