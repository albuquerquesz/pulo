import { FROG_TIRED_MIN_INTERRUPTED } from '@pulo/core/config/decisions';
import type { FrogEvent, FrogInputs, FrogMood } from '@pulo/core/domain/types';

/**
 * Máquina de estados do sapo (spec 03). Função pura sobre FrogInputs.
 * Prioridade: pouso > surpreso > comemorando > construindo > feliz > pensando > focado > cansado > dormindo > parado.
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

export const ROTULO_DO_ESTADO: Record<FrogMood, string> = {
  parado: 'parado',
  feliz: 'feliz',
  cansado: 'cansado',
  pensando: 'pensando',
  surpreso: 'surpreso',
  focado: 'focado',
  dormindo: 'dormindo',
  pouso: 'pousando',
  triste: 'triste',
  preocupado: 'preocupado',
  'sem-sinal': 'sem sinal',
  confuso: 'confuso',
  comemorando: 'comemorando',
  orgulhoso: 'orgulhoso',
  acenando: 'acenando',
  congelado: 'congelado',
  construindo: 'construindo',
};

export function rotuloDoSapo(estado: FrogMood): string {
  return `Sapo, ${ROTULO_DO_ESTADO[estado]}`;
}

export type Olhos =
  | 'abertos'
  | 'olhando'
  | 'arregalados'
  | 'focados'
  | 'felizes'
  | 'fechados'
  | 'caidos'
  | 'preocupados'
  | 'espiral'
  | 'desiguais'
  | 'orgulhosos'
  | 'apertados';

export type Sobrancelhas = 'nenhuma' | 'preocupadas' | 'tristes' | 'confusas';

export type Boca = 'sorriso' | 'aberta' | 'o' | 'reta' | 'pequena' | 'triste' | 'ondulada' | 'lado' | 'orgulhosa' | 'tremida' | 'lingua';

/** Pose do corpo: onde ficam os braços, o peito e o que o sapo segura. */
export type Corpo =
  | 'sentado'
  | 'caido'
  | 'maos-juntas'
  | 'antena'
  | 'cocando'
  | 'bracos-para-cima'
  | 'peito'
  | 'acenando'
  | 'encolhido'
  | 'martelando';

export type Extra = 'suor' | 'balao' | 'zzz' | 'brilhos' | 'impacto' | 'gota' | 'interrogacao' | 'confete' | 'cachecol' | 'tremor';

export interface Rosto {
  olhos: Olhos;
  sobrancelhas: Sobrancelhas;
  boca: Boca;
  corpo: Corpo;
  extras: readonly Extra[];
}

/** Rosto, corpo e extras de cada estado (prancha do conceito e spec 32). */
export const ROSTO_DO_ESTADO: Record<FrogMood, Rosto> = {
  parado: { olhos: 'abertos', sobrancelhas: 'nenhuma', boca: 'sorriso', corpo: 'sentado', extras: [] },
  feliz: { olhos: 'felizes', sobrancelhas: 'nenhuma', boca: 'aberta', corpo: 'sentado', extras: ['brilhos'] },
  cansado: { olhos: 'fechados', sobrancelhas: 'nenhuma', boca: 'reta', corpo: 'sentado', extras: ['suor'] },
  pensando: { olhos: 'olhando', sobrancelhas: 'nenhuma', boca: 'pequena', corpo: 'sentado', extras: ['balao'] },
  surpreso: { olhos: 'arregalados', sobrancelhas: 'nenhuma', boca: 'o', corpo: 'sentado', extras: ['brilhos'] },
  focado: { olhos: 'focados', sobrancelhas: 'nenhuma', boca: 'reta', corpo: 'sentado', extras: [] },
  dormindo: { olhos: 'fechados', sobrancelhas: 'nenhuma', boca: 'pequena', corpo: 'sentado', extras: ['zzz'] },
  pouso: { olhos: 'arregalados', sobrancelhas: 'nenhuma', boca: 'aberta', corpo: 'sentado', extras: ['impacto'] },
  triste: { olhos: 'caidos', sobrancelhas: 'tristes', boca: 'triste', corpo: 'caido', extras: ['gota'] },
  preocupado: { olhos: 'preocupados', sobrancelhas: 'preocupadas', boca: 'ondulada', corpo: 'maos-juntas', extras: [] },
  'sem-sinal': { olhos: 'espiral', sobrancelhas: 'nenhuma', boca: 'ondulada', corpo: 'antena', extras: [] },
  confuso: { olhos: 'desiguais', sobrancelhas: 'confusas', boca: 'lado', corpo: 'cocando', extras: ['interrogacao'] },
  comemorando: { olhos: 'felizes', sobrancelhas: 'nenhuma', boca: 'aberta', corpo: 'bracos-para-cima', extras: ['confete'] },
  orgulhoso: { olhos: 'orgulhosos', sobrancelhas: 'nenhuma', boca: 'orgulhosa', corpo: 'peito', extras: ['brilhos'] },
  acenando: { olhos: 'abertos', sobrancelhas: 'nenhuma', boca: 'aberta', corpo: 'acenando', extras: [] },
  congelado: { olhos: 'apertados', sobrancelhas: 'nenhuma', boca: 'tremida', corpo: 'encolhido', extras: ['cachecol', 'tremor'] },
  construindo: { olhos: 'focados', sobrancelhas: 'nenhuma', boca: 'lingua', corpo: 'martelando', extras: [] },
};

/**
 * Estado transitório com a duração do evento (FROG_EVENT_MS). Quem chama guarda `desde` e
 * passa `agora`; devolve o evento ainda ativo ou null. Não chama Date.now().
 */
export function eventoAtivo(
  evento: { tipo: NonNullable<FrogInputs['activeEvent']>; desde: number } | null,
  agora: number,
  duracoes: Record<FrogEvent, number>,
): FrogInputs['activeEvent'] {
  if (!evento) return null;
  return agora - evento.desde < duracoes[evento.tipo] ? evento.tipo : null;
}
