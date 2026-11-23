import { FROG_TIRED_MIN_INTERRUPTED } from '@pulo/core/config/decisions';
import type { FrogInputs, FrogMood, Phase } from '@pulo/core/domain/types';

/**
 * Máquina de estados do sapo (spec 03). Função pura sobre FrogInputs.
 * Prioridade: pouso > surpreso > feliz > pensando > focado > cansado > dormindo > parado.
 * Os eventos transitórios já chegam como `activeEvent`, que traz no máximo um (o de maior prioridade).
 */
export function estadoDoSapo(entrada: FrogInputs): FrogMood {
  if (entrada.activeEvent) return entrada.activeEvent;
  if (entrada.aiAnalyzing) return 'pensando';
  if (entrada.focusRunning) return 'focado';
  if (entrada.interruptedFocusToday >= FROG_TIRED_MIN_INTERRUPTED) return 'cansado';
  if (!entrada.withinUserDay) return 'dormindo';
  return 'parado';
}

/** Estados que têm arte em cada fase. Fases 1 e 2 (girino): só parado, feliz e cansado. */
export const ESTADOS_POR_FASE: Record<Phase, readonly FrogMood[]> = {
  1: ['parado', 'feliz', 'cansado'],
  2: ['parado', 'feliz', 'cansado'],
  3: ['parado', 'feliz', 'cansado', 'pensando', 'surpreso', 'focado', 'dormindo', 'pouso'],
  4: ['parado', 'feliz', 'cansado', 'pensando', 'surpreso', 'focado', 'dormindo', 'pouso'],
};

/** Estado que de fato é desenhado: sem arte na fase, cai para `parado`. */
export function estadoParaFase(fase: Phase, estado: FrogMood): FrogMood {
  return ESTADOS_POR_FASE[fase].includes(estado) ? estado : 'parado';
}

export const ROTULO_DO_ESTADO: Record<FrogMood, string> = {
  parado: 'parado',
  feliz: 'feliz',
  cansado: 'cansado',
  pensando: 'pensando',
  surpreso: 'surpreso',
  focado: 'focado',
  dormindo: 'dormindo',
  pouso: 'pousando',
};

export function rotuloDoSapo(estado: FrogMood): string {
  return `Sapo, ${ROTULO_DO_ESTADO[estado]}`;
}

export interface Rosto {
  olhos: 'abertos' | 'olhando' | 'arregalados' | 'focados' | 'felizes' | 'fechados';
  boca: 'sorriso' | 'aberta' | 'o' | 'reta' | 'pequena';
  extras: readonly ('suor' | 'balao' | 'zzz' | 'brilhos' | 'impacto')[];
}

/** Olhos, boca e extras de cada estado (prancha do conceito). */
export const ROSTO_DO_ESTADO: Record<FrogMood, Rosto> = {
  parado: { olhos: 'abertos', boca: 'sorriso', extras: [] },
  feliz: { olhos: 'felizes', boca: 'aberta', extras: ['brilhos'] },
  cansado: { olhos: 'fechados', boca: 'reta', extras: ['suor'] },
  pensando: { olhos: 'olhando', boca: 'pequena', extras: ['balao'] },
  surpreso: { olhos: 'arregalados', boca: 'o', extras: ['brilhos'] },
  focado: { olhos: 'focados', boca: 'reta', extras: [] },
  dormindo: { olhos: 'fechados', boca: 'pequena', extras: ['zzz'] },
  pouso: { olhos: 'arregalados', boca: 'aberta', extras: ['impacto'] },
};

/**
 * Estado transitório com a duração do evento (FROG_EVENT_MS). Quem chama guarda `desde` e
 * passa `agora`; devolve o evento ainda ativo ou null. Não chama Date.now().
 */
export function eventoAtivo(
  evento: { tipo: NonNullable<FrogInputs['activeEvent']>; desde: number } | null,
  agora: number,
  duracoes: Record<'pouso' | 'surpreso' | 'feliz', number>,
): FrogInputs['activeEvent'] {
  if (!evento) return null;
  return agora - evento.desde < duracoes[evento.tipo] ? evento.tipo : null;
}
