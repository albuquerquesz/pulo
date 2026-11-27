import type { RefObject } from 'react';

import type { ParteId } from '@pulo/core/domain/casa';
import { animar, centroNaTela, chegar, joiasVoando, PULINHO, RITMO_DO_PULINHO, semMovimento, useSaldoContando, type PontoNaTela } from '@/ui/compra';

export interface PalcoDaIlha {
  /** A cena inteira, com o desenho da ilha. */
  cena: RefObject<HTMLDivElement | null>;
  efeitos: RefObject<SVGGElement | null>;
  saldo: RefObject<HTMLDivElement | null>;
}

export interface ParteChegando {
  parte: ParteId;
  /** De onde as joias saem. */
  origem: PontoNaTela;
  preco: number;
  /** O saldo antes da compra. */
  saldo: number;
  /** Desenha a parte como pronta. */
  mostrar: () => void;
  /** O servidor recusou: a animação para onde está. */
  recusada: () => boolean;
}

/** A compra de uma parte na mesma linguagem do quarto: joias voando, saldo descendo e a parte caindo. */
export function useChegadaDaParte({ cena, efeitos, saldo }: PalcoDaIlha) {
  const { naTela, segurar, descer, soltar } = useSaldoContando();

  const animarChegada = async ({ parte, origem, preco, saldo: antes, mostrar, recusada }: ParteChegando) => {
    const alvo = cena.current?.querySelector<SVGGElement>(`[data-parte="${parte}"]`);
    if (semMovimento() || !alvo) {
      mostrar();
      return;
    }
    segurar(antes);
    await joiasVoando(origem, centroNaTela(alvo), preco);
    if (recusada()) return;
    descer(antes, antes - preco);
    if (saldo.current) void animar(saldo.current, PULINHO, RITMO_DO_PULINHO);
    mostrar();
    if (efeitos.current) await chegar({ camada: efeitos.current, alvo, tipo: 'chao', preco });
  };

  return { animar: animarChegada, soltar, saldoNaTela: naTela };
}
