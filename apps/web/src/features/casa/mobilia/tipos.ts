import type { ComponentType } from 'react';

import type { DecoracaoId } from '@pulo/core/domain/casa';

/** Os lugares fixos do quarto. */
export type LugarId = 'quadro' | 'janela' | 'relogio' | 'estante' | 'luminaria' | 'cama' | 'tapete' | 'assento' | 'bau' | 'planta';

/** Define a animação da chegada. */
export type TipoDeMovel = 'parede' | 'tapete' | 'chao';

export type DesenhoProps = { cor: string };

export interface Modelo {
  /** O id do item em `ROOM_DECOR`. */
  id: DecoracaoId;
  nome: string;
  /** A cor própria do modelo. */
  natural: string;
  Desenho: ComponentType<DesenhoProps>;
}

export interface Movel {
  id: LugarId;
  nome: string;
  onde: string;
  tipo: TipoDeMovel;
  /** Ordem de desenho: o menor fica atrás. */
  camada: number;
  /** O contorno tracejado do lugar vazio. */
  Fantasma: ComponentType;
  modelos: readonly [Modelo, ...Modelo[]];
}
