import { ROOM_GRID } from '@pulo/core/config/decisions';
import type { RoomSpot } from '@pulo/core/domain/types';

import { MOVEIS, type Movel } from './mobilia';

const posicao = (indice: number): RoomSpot => ({ x: indice % ROOM_GRID.columns, y: Math.floor(indice / ROOM_GRID.columns), rotation: 0 });

/**
 * A API guarda a posição numa grade e não sabe tirar um item. Cada lugar fixo é uma casa da grade, na ordem de
 * `MOVEIS`; a última casa quer dizer "guardado" (é seu, mas fora do quarto).
 */
export const GUARDADO: RoomSpot = posicao(ROOM_GRID.columns * ROOM_GRID.rows - 1);

export const posicaoDoLugar = (lugar: Movel): RoomSpot => posicao(MOVEIS.indexOf(lugar));

export const lugarDaPosicao = ({ x, y }: RoomSpot): Movel | null => MOVEIS[y * ROOM_GRID.columns + x] ?? null;
