import { ROOM_DECOR } from '@pulo/core/config/decisions';
import type { DecoracaoId } from '@pulo/core/domain/casa';

/**
 * A loja do quarto como no rascunho: tipos por lugar, 8 cores e preços.
 * PENDÊNCIA (spec 23): este catálogo e os preços devem ir para `ROOM_DECOR` em `decisions.ts`. Hoje a API só vende os
 * ids de `ROOM_DECOR`, numa cor só; o resto existe apenas no demo (memória).
 */
export type TipoDeLugar = 'parede' | 'chao' | 'tapete';

export interface ItemDaLoja {
  id: string;
  tipo: TipoDeLugar;
  emoji: string;
  nome: string;
  preco: number;
  /** O id que a API vende hoje para este item; sem ele, a conta ainda não pode comprar. */
  naApi?: DecoracaoId;
}

export const ITENS: readonly ItemDaLoja[] = [
  { id: 'quadro', tipo: 'parede', emoji: '🖼️', nome: 'Quadro', preco: 15, naApi: 'quadro' },
  { id: 'relogio', tipo: 'parede', emoji: '🕰️', nome: 'Relógio', preco: 20 },
  { id: 'prateleira', tipo: 'parede', emoji: '📚', nome: 'Prateleira', preco: 25, naApi: 'estante' },
  { id: 'bandeira', tipo: 'parede', emoji: '🎏', nome: 'Bandeirinhas', preco: 10 },
  { id: 'pendente', tipo: 'parede', emoji: '🪴', nome: 'Planta pendurada', preco: 18 },
  { id: 'janela', tipo: 'parede', emoji: '🪟', nome: 'Janela', preco: 40 },
  { id: 'planta', tipo: 'chao', emoji: '🪴', nome: 'Planta', preco: 15, naApi: 'vaso' },
  { id: 'cadeira', tipo: 'chao', emoji: '🪑', nome: 'Cadeira', preco: 20, naApi: 'poltrona' },
  { id: 'cama', tipo: 'chao', emoji: '🛏️', nome: 'Cama', preco: 60 },
  { id: 'sofa', tipo: 'chao', emoji: '🛋️', nome: 'Sofá', preco: 70 },
  { id: 'luminaria', tipo: 'chao', emoji: '💡', nome: 'Luminária', preco: 25, naApi: 'luminaria' },
  { id: 'bau', tipo: 'chao', emoji: '🧰', nome: 'Baú', preco: 30 },
  { id: 'pelucia', tipo: 'chao', emoji: '🧸', nome: 'Pelúcia', preco: 12 },
  { id: 'violao', tipo: 'chao', emoji: '🎸', nome: 'Violão', preco: 35 },
  { id: 'tapete', tipo: 'tapete', emoji: '🟢', nome: 'Tapete redondo', preco: 20, naApi: 'tapete' },
];

export interface Cor {
  id: string;
  nome: string;
  /** Filtro sobre o emoji, até cada item ter arte própria. */
  filtro: string;
  /** Cor do tapete. */
  tapete: string;
  acrescimo: number;
}

export const COR_NATURAL: Cor = { id: 'natural', nome: 'Natural', filtro: 'none', tapete: '#C9A96A', acrescimo: 0 };

export const CORES: readonly Cor[] = [
  COR_NATURAL,
  { id: 'rosa', nome: 'Rosa', filtro: 'hue-rotate(300deg) saturate(1.2)', tapete: '#FF9DB4', acrescimo: 0 },
  { id: 'verde', nome: 'Verde', filtro: 'hue-rotate(90deg)', tapete: '#9DD96C', acrescimo: 0 },
  { id: 'agua', nome: 'Água', filtro: 'hue-rotate(160deg)', tapete: '#7FD8D8', acrescimo: 0 },
  { id: 'lilas', nome: 'Lilás', filtro: 'hue-rotate(250deg)', tapete: '#B583FF', acrescimo: 0 },
  { id: 'dourado', nome: 'Dourado', filtro: 'sepia(.6) saturate(2.2) hue-rotate(-10deg)', tapete: '#F5C64B', acrescimo: 0 },
  { id: 'noite', nome: 'Noite', filtro: 'brightness(.62) saturate(.8)', tapete: '#4A5A7A', acrescimo: 0 },
  { id: 'brilho', nome: 'Brilho', filtro: 'saturate(2.4) brightness(1.15)', tapete: '#FF7A59', acrescimo: 10 },
];

/** Um item numa cor. */
export interface Escolha {
  item: ItemDaLoja;
  cor: Cor;
}

/** `completa`: o catálogo do rascunho (demo). `servidor`: só o que a API vende hoje (conta). */
export type Loja = 'completa' | 'servidor';

/** O id gravado de uma escolha, ou `null` se esta loja não a vende. */
export function idDaCompra({ item, cor }: Escolha, loja: Loja): string | null {
  const natural = cor.id === COR_NATURAL.id;
  // A cor natural usa o id da API também no demo, para as duas lojas lerem os mesmos registros.
  if (natural && item.naApi) return item.naApi;
  if (loja === 'servidor') return null;
  return natural ? item.id : `${item.id}:${cor.id}`;
}

export function precoDe({ item, cor }: Escolha, loja: Loja): number {
  if (loja === 'servidor' && item.naApi) return ROOM_DECOR.itemCost[item.naApi];
  return item.preco + cor.acrescimo;
}

/** A escolha de um registro do quarto; `null` para um id que a loja não conhece. */
export function escolhaDoId(id: string): Escolha | null {
  const [base, corId = COR_NATURAL.id] = id.split(':');
  const item = ITENS.find((i) => i.naApi === base) ?? ITENS.find((i) => i.id === base);
  const cor = CORES.find((c) => c.id === corId);
  return item && cor ? { item, cor } : null;
}
