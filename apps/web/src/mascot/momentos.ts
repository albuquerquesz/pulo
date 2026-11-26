/**
 * Mapa de momentos (spec 32): a única tabela que liga o que acontece no app a um humor do sapo.
 * As telas pedem o momento; nenhuma escolhe o humor direto.
 */
import type { FrogMood } from '@pulo/core/domain/types';

export const HUMOR_DO_MOMENTO = {
  'boas-vindas': 'acenando',
  'sem-sinal': 'sem-sinal',
  erro: 'confuso',
  'nao-encontrado': 'confuso',
  'lista-vazia': 'pensando',
  'fim-do-dia-sem-nada': 'preocupado',
  'sequencia-perdida': 'triste',
  'gelo-gasto': 'congelado',
  conquista: 'comemorando',
  recorde: 'orgulhoso',
  'compra-na-ilha': 'construindo',
  'foco-rodando': 'focado',
  'descanso-marcado': 'dormindo',
  'conectando-conta': 'pensando',
  'pedido-de-acesso': 'surpreso',
} as const satisfies Record<string, FrogMood>;

export type Momento = keyof typeof HUMOR_DO_MOMENTO;
