import { PARTES, podeComprar, progressoPorCamada, textoDoRequisito, verCasa, type CamadaDaCasa, type EstadoDaCasa, type ParteId, type PodeComprar, type ProgressoDaCamada } from '@pulo/core/domain/casa';
import { verConquistas } from '@pulo/core/domain/achievements';
import type { Achievement, Clock, Repository } from '@pulo/core/domain/types';

export type SituacaoDaParte = 'feita' | 'disponivel' | 'cara' | 'trancada';

export interface ParteAVenda {
  id: ParteId;
  nome: string;
  emoji: string;
  camada: CamadaDaCasa;
  custo: number;
  situacao: SituacaoDaParte;
  /** Por que está trancada; null nas outras. */
  motivo: string | null;
}

export interface IlhaNaTela {
  saldo: number;
  construidas: ParteId[];
  total: number;
  partes: ParteAVenda[];
  progresso: Record<CamadaDaCasa, ProgressoDaCamada>;
  /** A parte mais barata que o saldo já paga: o próximo alvo. */
  alvo: ParteId | null;
}

const SITUACAO: Record<PodeComprar['situacao'], SituacaoDaParte> = {
  ja_tem: 'feita',
  ok: 'disponivel',
  falta_requisito: 'trancada',
  joias_insuficientes: 'cara',
};

/**
 * O que a Ilha mostra. `comprando` é a parte com a compra a caminho: já aparece pronta e paga,
 * sem descontar duas vezes quando o repositório passa a tê-la.
 */
export function ilhaNaTela(casa: EstadoDaCasa, comprando: ParteId | null = null): IlhaNaTela {
  const pendente = casa.partes.find((p) => p.id === comprando && !p.construida);
  const saldo = casa.saldo - (pendente?.custo ?? 0);
  const construidas = casa.partes.filter((p) => p.construida || p === pendente).map((p) => p.id);
  const partes = PARTES.map(({ id, nome, emoji, camada, custo }): ParteAVenda => {
    const pode = podeComprar(id, construidas, saldo);
    const motivo = pode.situacao === 'falta_requisito' ? textoDoRequisito(pode.requer) : null;
    return { id, nome, emoji, camada, custo, situacao: SITUACAO[pode.situacao], motivo };
  });
  const [alvo] = partes.filter((p) => p.situacao === 'disponivel').sort((a, b) => a.custo - b.custo);
  return { saldo, construidas, total: casa.total, partes, progresso: progressoPorCamada(construidas), alvo: alvo?.id ?? null };
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

/** O aviso do cais: o que falta para abrir a próxima ilha, ou que ela chega em breve. */
export function textoDoPortal(construidas: number, total: number): string {
  const faltam = total - construidas;
  if (faltam <= 0) return 'A próxima ilha chega em breve!';
  return `A próxima ilha abre com a casa inteira. Falta${faltam === 1 ? '' : 'm'} ${faltam} parte${faltam === 1 ? '' : 's'}.`;
}
