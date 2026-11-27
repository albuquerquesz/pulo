import { idDaDecoracao, lerDecoracao, precoDaDecoracao, type CorDaDecoracao, type DecoracaoId } from '@pulo/core/domain/casa';

/**
 * A loja do quarto como no rascunho: tipos por lugar e 8 cores. Os preços e os ids gravados vêm de `ROOM_DECOR`
 * (`decisions.ts`), que vende todo item em todas as cores.
 */
export type TipoDeLugar = 'parede' | 'chao' | 'tapete';

export interface ItemDaLoja {
  id: string;
  tipo: TipoDeLugar;
  emoji: string;
  nome: string;
  /** O id do item em `ROOM_DECOR`. */
  naApi: DecoracaoId;
}

export const ITENS: readonly ItemDaLoja[] = [
  { id: 'quadro', tipo: 'parede', emoji: '🖼️', nome: 'Quadro', naApi: 'quadro' },
  { id: 'relogio', tipo: 'parede', emoji: '🕰️', nome: 'Relógio', naApi: 'relogio' },
  { id: 'prateleira', tipo: 'parede', emoji: '📚', nome: 'Prateleira', naApi: 'estante' },
  { id: 'bandeira', tipo: 'parede', emoji: '🎏', nome: 'Bandeirinhas', naApi: 'bandeira' },
  { id: 'pendente', tipo: 'parede', emoji: '🪴', nome: 'Planta pendurada', naApi: 'pendente' },
  { id: 'janela', tipo: 'parede', emoji: '🪟', nome: 'Janela', naApi: 'janela' },
  { id: 'planta', tipo: 'chao', emoji: '🪴', nome: 'Planta', naApi: 'vaso' },
  { id: 'cadeira', tipo: 'chao', emoji: '🪑', nome: 'Cadeira', naApi: 'poltrona' },
  { id: 'cama', tipo: 'chao', emoji: '🛏️', nome: 'Cama', naApi: 'cama' },
  { id: 'sofa', tipo: 'chao', emoji: '🛋️', nome: 'Sofá', naApi: 'sofa' },
  { id: 'luminaria', tipo: 'chao', emoji: '💡', nome: 'Luminária', naApi: 'luminaria' },
  { id: 'bau', tipo: 'chao', emoji: '🧰', nome: 'Baú', naApi: 'bau' },
  { id: 'pelucia', tipo: 'chao', emoji: '🧸', nome: 'Pelúcia', naApi: 'pelucia' },
  { id: 'violao', tipo: 'chao', emoji: '🎸', nome: 'Violão', naApi: 'violao' },
  { id: 'tapete', tipo: 'tapete', emoji: '🟢', nome: 'Tapete redondo', naApi: 'tapete' },
];

export interface Cor {
  /** A cor em `ROOM_DECOR`; `null` é a natural. */
  api: CorDaDecoracao | null;
  id: string;
  nome: string;
  /** Filtro sobre o emoji, até cada item ter arte própria. */
  filtro: string;
  /** Cor do tapete. */
  tapete: string;
}

export const COR_NATURAL: Cor = { api: null, id: 'natural', nome: 'Natural', filtro: 'none', tapete: '#C9A96A' };

export const CORES: readonly Cor[] = [
  COR_NATURAL,
  { api: 'rosa', id: 'rosa', nome: 'Rosa', filtro: 'hue-rotate(300deg) saturate(1.2)', tapete: '#FF9DB4' },
  { api: 'verde', id: 'verde', nome: 'Verde', filtro: 'hue-rotate(90deg)', tapete: '#9DD96C' },
  { api: 'agua', id: 'agua', nome: 'Água', filtro: 'hue-rotate(160deg)', tapete: '#7FD8D8' },
  { api: 'lilas', id: 'lilas', nome: 'Lilás', filtro: 'hue-rotate(250deg)', tapete: '#B583FF' },
  { api: 'dourado', id: 'dourado', nome: 'Dourado', filtro: 'sepia(.6) saturate(2.2) hue-rotate(-10deg)', tapete: '#F5C64B' },
  { api: 'noite', id: 'noite', nome: 'Noite', filtro: 'brightness(.62) saturate(.8)', tapete: '#4A5A7A' },
  { api: 'brilho', id: 'brilho', nome: 'Brilho', filtro: 'saturate(2.4) brightness(1.15)', tapete: '#FF7A59' },
];

/** Um item numa cor. */
export interface Escolha {
  item: ItemDaLoja;
  cor: Cor;
}

/** O id gravado de uma escolha. */
export const idDaCompra = ({ item, cor }: Escolha): string => idDaDecoracao({ item: item.naApi, cor: cor.api });

export const precoDe = (escolha: Escolha): number => precoDaDecoracao(idDaCompra(escolha)) ?? 0;

/** A escolha de um registro do quarto; `null` para um id que a loja não conhece. */
export function escolhaDoId(id: string): Escolha | null {
  const lida = lerDecoracao(id);
  const item = ITENS.find((i) => i.naApi === lida?.item);
  const cor = CORES.find((c) => c.api === lida?.cor);
  return item && cor ? { item, cor } : null;
}
