import { MINUTE_MS } from '../domain/clock';
import type { Clock, DateKey } from '../domain/types';
import { sp } from '../domain/test-utils';

const DIA_MS = 24 * 60 * MINUTE_MS;

/** Um relógio parado que os testes empurram para a frente (ou para trás). */
export interface RelogioDeExemplo extends Clock {
  advanceDays(n: number): void;
}

/** Instante de uma data e hora locais (America/Sao_Paulo). */
export function localToMs(date: DateKey, minutosDoDia: number): number {
  const [ano, mes, dia] = date.split('-').map(Number);
  return sp(ano, mes, dia, 0, minutosDoDia);
}

/** Sem argumento, começa no domingo 22/11/2026, 20h: o fim das quatro semanas de exemplo. */
export function criarRelogio(inicio: number = localToMs('2026-11-22', 20 * 60)): RelogioDeExemplo {
  let atual = inicio;
  return {
    now: () => atual,
    advanceDays(n) {
      atual += n * DIA_MS;
    },
  };
}
