import { ROOM_GRID } from '@pulo/core/config/decisions';
import type { RoomSpot } from '@pulo/core/domain/types';

import type { TipoDeLugar } from './catalogo';

/** Os lugares do quarto marcados com + (coordenadas do desenho do cômodo). */
export interface Lugar {
  id: string;
  tipo: TipoDeLugar;
  /** Parede da esquerda ou da direita: define a inclinação do item. */
  lado?: 'esquerda' | 'direita';
  x: number;
  y: number;
  nome: string;
}

/** A ordem é o endereço gravado na API: só acrescente no fim. */
export const LUGARES: readonly Lugar[] = [
  { id: 'p1', tipo: 'parede', lado: 'esquerda', x: 175, y: 370, nome: 'parede esquerda, primeiro lugar' },
  { id: 'p2', tipo: 'parede', lado: 'esquerda', x: 295, y: 310, nome: 'parede esquerda, segundo lugar' },
  { id: 'p3', tipo: 'parede', lado: 'direita', x: 505, y: 305, nome: 'parede direita, primeiro lugar' },
  { id: 'p4', tipo: 'parede', lado: 'direita', x: 630, y: 365, nome: 'parede direita, segundo lugar' },
  { id: 'c1', tipo: 'chao', x: 235, y: 478, nome: 'chão, primeiro lugar' },
  { id: 'c2', tipo: 'chao', x: 400, y: 405, nome: 'chão, segundo lugar' },
  { id: 'c3', tipo: 'chao', x: 565, y: 478, nome: 'chão, terceiro lugar' },
  { id: 'c4', tipo: 'chao', x: 310, y: 545, nome: 'chão, quarto lugar' },
  { id: 'c5', tipo: 'chao', x: 490, y: 548, nome: 'chão, quinto lugar' },
  { id: 't1', tipo: 'tapete', x: 400, y: 532, nome: 'centro, para o tapete' },
];

const posicao = (indice: number): RoomSpot => ({ x: indice % ROOM_GRID.columns, y: Math.floor(indice / ROOM_GRID.columns), rotation: 0 });

/**
 * A API guarda a posição numa grade e não sabe tirar um item. Cada lugar é uma casa da grade, na ordem de `LUGARES`;
 * a última casa quer dizer "guardado" (é seu, mas fora do quarto).
 */
export const GUARDADO: RoomSpot = posicao(ROOM_GRID.columns * ROOM_GRID.rows - 1);

export const posicaoDoLugar = (lugar: Lugar): RoomSpot => posicao(LUGARES.indexOf(lugar));

export const lugarDaPosicao = ({ x, y }: RoomSpot): Lugar | null => LUGARES[y * ROOM_GRID.columns + x] ?? null;
