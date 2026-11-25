import { verCasa, type EstadoDaCasa, type ParteId, type ParteNaCasa } from '@pulo/core/domain/casa';
import { verConquistas } from '@pulo/core/domain/achievements';
import type { Achievement, Clock, Repository } from '@pulo/core/domain/types';

import { EMOJI_DA_PARTE } from '../casca/logic';

export type SituacaoDaParte = 'feita' | 'disponivel' | 'cara';

export interface ParteAVenda {
  id: ParteId;
  nome: string;
  emoji: string;
  custo: number;
  situacao: SituacaoDaParte;
}

export interface IlhaNaTela {
  saldo: number;
  construidas: ParteId[];
  total: number;
  partes: ParteAVenda[];
}

const situacaoDa = (parte: ParteNaCasa, saldo: number): SituacaoDaParte =>
  parte.construida ? 'feita' : saldo < parte.custo ? 'cara' : 'disponivel';

/**
 * O que a Ilha mostra. `comprando` é a parte com a compra a caminho: já aparece pronta e paga,
 * sem descontar duas vezes quando o repositório passa a tê-la.
 */
export function ilhaNaTela(casa: EstadoDaCasa, comprando: ParteId | null = null): IlhaNaTela {
  const pendente = casa.partes.find((p) => p.id === comprando && !p.construida);
  const saldo = casa.saldo - (pendente?.custo ?? 0);
  const partes = casa.partes.map((p) => (p === pendente ? { ...p, construida: true } : p));
  return {
    saldo,
    construidas: partes.filter((p) => p.construida).map((p) => p.id),
    total: casa.total,
    partes: partes.map((p) => ({ id: p.id, nome: p.nome, emoji: EMOJI_DA_PARTE[p.id], custo: p.custo, situacao: situacaoDa(p, saldo) })),
  };
}

/** As conquistas que passaram a valer entre duas leituras. */
export function conquistasNovas(antes: readonly Achievement[], depois: readonly Achievement[]): Achievement[] {
  const tinha = new Set(antes.filter((c) => c.conquistada).map((c) => c.id));
  return depois.filter((c) => c.conquistada && !tinha.has(c.id));
}

export const textoDaConquista = ({ emoji, nome }: Achievement): string => `Conquista nova: ${[emoji, nome].filter(Boolean).join(' ')}`;

export async function carregarIlha(repo: Repository, clock: Clock) {
  const [casa, conquistas] = await Promise.all([verCasa(repo), verConquistas(repo, clock)]);
  return { casa, conquistas };
}
