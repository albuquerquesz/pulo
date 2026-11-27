import { useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';

import type { ComodoId } from '@pulo/core/domain/casa';
import type { RoomDecor } from '@pulo/core/domain/types';
import { animar, centroNaTela, chegar, esperar, joiasVoando, PULINHO, RITMO_DO_PULINHO, semMovimento, sumir, useSaldoContando } from '@/ui/compra';

import { useApp } from '../app';
import type { Escolha } from './catalogo';
import { comemorar } from './comemorar';
import { colocadosNoQuarto, comprarOuColocar, estadoDaCompra, tirarDoLugar, type Colocados } from './decoracao';
import type { LugarId, Movel } from './mobilia';

/** O que um lugar mostra enquanto a animação roda, no lugar do que está gravado. */
interface Encenacao {
  lugar: LugarId;
  mostrando: Escolha | null;
}

export interface CompraNaCena {
  escolha: Escolha;
  /** De onde as joias saem. */
  botao: Element;
  quarto: readonly RoomDecor[];
  saldo: number;
}

export interface PalcoDaCompra {
  /** A cena inteira, com o desenho e o saldo. */
  cena: RefObject<HTMLDivElement | null>;
  /** A camada vazia do desenho onde os efeitos entram. */
  efeitos: RefObject<SVGGElement | null>;
  sapo: RefObject<SVGGElement | null>;
  saldo: RefObject<HTMLDivElement | null>;
  comodo: ComodoId;
  recarregar: () => Promise<void>;
}

/** Comprar, colocar e tirar um móvel, com a animação da compra. Uma escrita de cada vez. */
export function useCompraNoQuarto({ cena, efeitos, sapo, saldo, comodo, recarregar }: PalcoDaCompra) {
  const { repo, clock, refresh } = useApp();
  const { naTela, segurar, descer, soltar } = useSaldoContando();
  const [encenacao, setEncenacao] = useState<Encenacao | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const trancado = useRef(false);

  const doLugar = (lugar: LugarId) => cena.current?.querySelector(`[data-lugar="${lugar}"]`) ?? null;
  const movelDo = (lugar: LugarId) => cena.current?.querySelector<SVGGElement>(`[data-lugar="${lugar}"] .movel`) ?? null;

  const umaDeCadaVez = async (acao: () => Promise<void>) => {
    if (trancado.current) return;
    trancado.current = true;
    setOcupado(true);
    try {
      await acao();
    } finally {
      await recarregar();
      setEncenacao(null);
      soltar();
      setOcupado(false);
      trancado.current = false;
      refresh();
    }
  };

  /** `false` se não gravou: o aviso do repositório já foi mostrado e o quarto fica como estava. */
  const gravar = (acao: () => Promise<boolean>) => acao().catch(() => false);

  const comprar = ({ escolha, botao, quarto, saldo: antes }: CompraNaCena) =>
    umaDeCadaVez(async () => {
      const lugar = escolha.lugar.id;
      const anterior = colocadosNoQuarto(quarto, comodo).get(lugar) ?? null;
      const { acao, preco } = estadoDaCompra({ quarto, saldo: antes, escolha, comodo });
      const pago = acao === 'comprar' ? preco : 0;
      const animado = !semMovimento();
      // Lido antes de a prévia sair, para as joias terem onde pousar.
      const alvo = doLugar(lugar);
      const voo = animado && pago && alvo ? joiasVoando(centroNaTela(botao), centroNaTela(alvo), pago) : Promise.resolve();
      if (animado) {
        setEncenacao({ lugar, mostrando: anterior });
        segurar(antes);
      }
      const gravou = await gravar(() => comprarOuColocar(repo, clock, { escolha, comodo }));
      if (!gravou || !animado) return;
      await voo;
      if (pago) {
        descer(antes, antes - pago);
        if (saldo.current) void animar(saldo.current, PULINHO, RITMO_DO_PULINHO);
      }
      const antigo = movelDo(lugar);
      if (anterior && antigo && efeitos.current) await sumir(efeitos.current, antigo);
      flushSync(() => setEncenacao({ lugar, mostrando: escolha }));
      const novo = movelDo(lugar);
      if (!novo || !efeitos.current) return;
      const caixa = await chegar({ camada: efeitos.current, alvo: novo, tipo: escolha.lugar.tipo, preco: pago });
      if (sapo.current) void comemorar(sapo.current, efeitos.current, caixa);
      await esperar(500);
    });

  const tirar = (lugar: Movel, quarto: readonly RoomDecor[]) =>
    umaDeCadaVez(async () => {
      const anterior = colocadosNoQuarto(quarto, comodo).get(lugar.id) ?? null;
      const animado = !semMovimento();
      if (animado) setEncenacao({ lugar: lugar.id, mostrando: anterior });
      const gravou = await gravar(() => tirarDoLugar(repo, lugar, comodo).then(() => true));
      const antigo = movelDo(lugar.id);
      if (!gravou || !animado || !antigo || !efeitos.current) return;
      await sumir(efeitos.current, antigo);
      flushSync(() => setEncenacao({ lugar: lugar.id, mostrando: null }));
    });

  /** O quarto como a tela mostra agora. */
  const naCena = (colocados: Colocados): Colocados => {
    if (!encenacao) return colocados;
    const copia = new Map(colocados);
    if (encenacao.mostrando) copia.set(encenacao.lugar, encenacao.mostrando);
    else copia.delete(encenacao.lugar);
    return copia;
  };

  return { comprar, tirar, naCena, ocupado, encenando: encenacao !== null, saldoNaTela: naTela };
}
