import { FROG_EVENT_MS } from '@pulo/core/config/decisions';
import type { FrogInputs, FrogMood } from '@pulo/core/domain/types';

import {
  ROSTO_DO_ESTADO,
  ROTULO_DO_ESTADO,
  estadoDoSapo,
  eventoAtivo,
  rotuloDoSapo,
} from './machine';

const base: FrogInputs = {
  phase: 3,
  interruptedFocusToday: 0,
  focusRunning: false,
  aiAnalyzing: false,
  activeEvent: null,
  withinUserDay: true,
};

const tabela: [string, Partial<FrogInputs>, FrogMood][] = [
  ['sem nada: parado', {}, 'parado'],
  ['fora do dia: dormindo', { withinUserDay: false }, 'dormindo'],
  ['2 focos interrompidos: cansado', { interruptedFocusToday: 2 }, 'cansado'],
  ['3 focos interrompidos: cansado', { interruptedFocusToday: 3 }, 'cansado'],
  ['1 foco interrompido: parado', { interruptedFocusToday: 1 }, 'parado'],
  ['cansado vence dormindo', { interruptedFocusToday: 2, withinUserDay: false }, 'cansado'],
  ['foco vence cansado', { focusRunning: true, interruptedFocusToday: 2 }, 'focado'],
  ['foco vence dormindo', { focusRunning: true, withinUserDay: false }, 'focado'],
  ['IA analisando vence foco', { aiAnalyzing: true, focusRunning: true }, 'pensando'],
  ['feliz vence pensando', { activeEvent: 'feliz', aiAnalyzing: true }, 'feliz'],
  ['feliz vence foco e cansado', { activeEvent: 'feliz', focusRunning: true, interruptedFocusToday: 2 }, 'feliz'],
  ['surpreso durante foco', { activeEvent: 'surpreso', focusRunning: true }, 'surpreso'],
  ['pouso vence tudo', { activeEvent: 'pouso', aiAnalyzing: true, focusRunning: true, interruptedFocusToday: 2, withinUserDay: false }, 'pouso'],
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

describe('estados', () => {
  const todos = Object.keys(ROSTO_DO_ESTADO) as FrogMood[];

  test('todo estado tem rosto e rótulo', () => {
    expect(todos).toHaveLength(8);
    for (const e of todos) {
      expect(ROSTO_DO_ESTADO[e]).toBeDefined();
      expect(ROTULO_DO_ESTADO[e].length).toBeGreaterThan(0);
      expect(rotuloDoSapo(e)).toMatch(/^Sapo, /);
    }
  });
});
