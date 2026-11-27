import { idDaDecoracao, lerDecoracao, precoDaDecoracao, type CorDaDecoracao } from '@pulo/core/domain/casa';

import { MOVEIS, type Modelo, type Movel } from './mobilia';

/**
 * A loja do quarto como no rascunho: cada lugar tem os seus modelos, em 8 cores. Os preços e os ids gravados vêm de
 * `ROOM_DECOR` (`decisions.ts`), que vende todo modelo em todas as cores.
 */
export interface Cor {
  /** A cor em `ROOM_DECOR`; `null` é a natural. */
  api: CorDaDecoracao | null;
  id: string;
  nome: string;
  /** `null`: a cor própria do modelo. */
  tinta: string | null;
}

export const COR_NATURAL: Cor = { api: null, id: 'natural', nome: 'Natural', tinta: null };

export const CORES: readonly Cor[] = [
  COR_NATURAL,
  { api: 'rosa', id: 'rosa', nome: 'Rosa', tinta: '#ff9db4' },
  { api: 'verde', id: 'verde', nome: 'Verde', tinta: '#9dd96c' },
  { api: 'agua', id: 'agua', nome: 'Água', tinta: '#7fd8d8' },
  { api: 'lilas', id: 'lilas', nome: 'Lilás', tinta: '#b583ff' },
  { api: 'dourado', id: 'dourado', nome: 'Dourado', tinta: '#f5c64b' },
  { api: 'noite', id: 'noite', nome: 'Noite', tinta: '#4a5a7a' },
  { api: 'brilho', id: 'brilho', nome: 'Brilho', tinta: '#ff7a59' },
];

/** Um modelo numa cor, no lugar dele. */
export interface Escolha {
  lugar: Movel;
  modelo: Modelo;
  cor: Cor;
}

/** O id gravado de uma escolha. */
export const idDaCompra = ({ modelo, cor }: Escolha): string => idDaDecoracao({ item: modelo.id, cor: cor.api });

export const precoDe = (escolha: Escolha): number => precoDaDecoracao(idDaCompra(escolha)) ?? 0;

export const tintaDe = ({ modelo, cor }: Escolha): string => cor.tinta ?? modelo.natural;

/** O que o lugar mostra antes de qualquer escolha. */
export const escolhaInicial = (lugar: Movel): Escolha => ({ lugar, modelo: lugar.modelos[0], cor: COR_NATURAL });

/** A escolha de um registro do quarto; `null` para um id que a loja não vende (os itens antigos). */
export function escolhaDoId(id: string): Escolha | null {
  const lida = lerDecoracao(id);
  const cor = CORES.find((c) => c.api === lida?.cor);
  if (!lida || !cor) return null;
  for (const lugar of MOVEIS) {
    const modelo = lugar.modelos.find((m) => m.id === lida.item);
    if (modelo) return { lugar, modelo, cor };
  }
  return null;
}
