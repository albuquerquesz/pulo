import { useRef } from 'react';

import { artigoDaParte, COMODOS, type ComodoDaCasa, type ComodoId } from '@pulo/core/domain/casa';
import { textoDeFalta } from '@pulo/core/domain/joias';
import type { RoomDecor } from '@pulo/core/domain/types';
import { BotaoFechar, Joia, useDialogo } from '@/ui';

import { CORES, precoDe, tintaDe, type Escolha } from './catalogo';
import { colocadosNoQuarto, ehMeu, emOutroComodo, estadoDaCompra, type EstadoDaCompra } from './decoracao';
import { Miniatura } from './Miniatura';
import { MOVEIS, type Movel } from './mobilia';

const BOTAO_DA_LOJA =
  'cursor-pointer rounded-[14px] border-4 border-contorno px-3.5 py-2.5 text-sm font-black tracking-wide text-contorno uppercase disabled:cursor-not-allowed disabled:opacity-50 md:py-3';
export const BOTAO_NEUTRO = `${BOTAO_DA_LOJA} bg-bege shadow-[inset_0_-5px_0_var(--pulo-bege-borda)]`;
const BOTAO_DE_COMPRA = `${BOTAO_DA_LOJA} bg-lima-clara shadow-[inset_0_-5px_0_var(--pulo-lima)]`;

const TITULO = 'text-xs font-black tracking-wider text-contorno/70 uppercase';
const OPCAO =
  'flex cursor-pointer flex-col items-center gap-1 rounded-[14px] border-4 border-contorno bg-creme px-1 py-1.5 font-black text-contorno aria-pressed:bg-lima-forte disabled:cursor-default';

const nomeDoComodo = (id: ComodoId) => (COMODOS.find((c) => c.id === id)?.nome ?? id).toLowerCase();

const TEXTO_DA_ACAO = { colocar: 'Colocar', no_lugar: 'No lugar ✓' } as const;

function RotuloDaCompra({ compra }: { compra: EstadoDaCompra }) {
  if (compra.acao !== 'comprar') return TEXTO_DA_ACAO[compra.acao];
  return (
    <>
      Comprar{' '}
      <span className="ml-1.5 inline-flex items-center gap-1">
        <Joia />
        {compra.preco}
      </span>
    </>
  );
}

type PrecoProps = { meu: boolean; preco: number; /** "está na cozinha", quando o item está em outro cômodo. */ onde: string | null };

function Preco({ meu, preco, onde }: PrecoProps) {
  if (meu) return <span className="text-center text-xs normal-case">{onde ?? '✓ seu'}</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <Joia largura={10} altura={12} />
      {preco}
    </span>
  );
}

const rotuloDa = (nome: string, meu: boolean, preco: number, onde: string | null) =>
  `${nome}, ${meu ? (onde ?? 'já é seu') : `${preco} joias`}`;

export type PainelDaLojaProps = {
  /** O que a pessoa está olhando: o lugar, o modelo e a cor. */
  escolha: Escolha;
  quarto: readonly RoomDecor[];
  saldo: number;
  /** O cômodo que está sendo decorado. */
  comodo: ComodoDaCasa;
  /** Uma compra a caminho: nada responde. */
  ocupado: boolean;
  onLugar: (lugar: Movel) => void;
  onEscolher: (escolha: Escolha) => void;
  /** `botao` é de onde as joias saem. */
  onComprar: (botao: Element) => void;
  onTirar: () => void;
  onFechar: () => void;
};

/** A loja do quarto: um painel que não cobre o cômodo, para a prévia ficar à vista. */
export function PainelDaLoja({ escolha, quarto, saldo, comodo, ocupado, onLugar, onEscolher, onComprar, onTirar, onFechar }: PainelDaLojaProps) {
  const { lugar } = escolha;
  const painel = useRef<HTMLElement>(null);
  /** "está no quarto" para um item colocado em outro cômodo. */
  const ondeEsta = (opcao: Escolha) => {
    const outro = emOutroComodo(quarto, opcao, comodo.id);
    return outro ? `está n${artigoDaParte(outro)} ${nomeDoComodo(outro)}` : null;
  };
  const colocados = colocadosNoQuarto(quarto, comodo.id);
  const compra = estadoDaCompra({ quarto, saldo, escolha, comodo: comodo.id });
  // Com uma compra a caminho a loja não fecha, para a animação não trocar de cômodo no meio.
  const fechar = () => {
    if (!ocupado) onFechar();
  };
  // O painel não cobre o cômodo: o Tab segue livre.
  useDialogo({ aberto: true, onFechar: fechar, caixa: painel, prender: false });
  const falta = compra.acao === 'comprar' && compra.bloqueado ? textoDeFalta(compra.preco - saldo) : null;
  const aqui = ondeEsta(escolha);
  return (
    <section
      ref={painel}
      role="dialog"
      tabIndex={-1}
      aria-label={`Loja: ${comodo.nome}`}
      className="relative z-5 flex max-h-[58%] shrink-0 flex-col border-t-4 border-contorno bg-folha text-contorno md:max-h-none md:w-[380px] md:border-t-0 md:border-l-4"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pt-3 pb-2 md:gap-4 md:px-4">
        <div role="group" aria-label={`Lugares d${artigoDaParte(comodo.id)} ${comodo.nome.toLowerCase()}`} className="flex shrink-0 gap-2 max-md:faixa-lateral md:flex-wrap">
          {MOVEIS.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={ocupado}
              aria-pressed={m.id === lugar.id}
              onClick={() => onLugar(m)}
              className="flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-[14px] border-[3px] border-contorno bg-creme px-2.5 text-[13px] font-black aria-pressed:bg-lima-forte"
            >
              <i aria-hidden="true" className={`size-2 rounded-full border-2 border-contorno ${colocados.has(m.id) ? 'bg-lima' : 'border-dashed'}`} />
              {m.nome}
            </button>
          ))}
        </div>
        <div className="flex items-start justify-between gap-2">
          <p className="flex flex-col">
            <b className="text-xl font-black">{lugar.nome}</b>
            <span className="text-xs font-bold text-contorno/70">{lugar.onde}</span>
          </p>
          <span className="relative size-11 shrink-0">
            <BotaoFechar onFechar={fechar} className="top-0 right-0" />
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className={TITULO}>Modelo</h2>
          <div role="group" aria-label="Modelo" className="grid grid-cols-3 gap-2">
            {lugar.modelos.map((modelo) => {
              const opcao = { lugar, modelo, cor: escolha.cor };
              const meu = ehMeu(quarto, opcao);
              const preco = precoDe(opcao);
              return (
                <button
                  key={modelo.id}
                  type="button"
                  disabled={ocupado}
                  aria-label={rotuloDa(modelo.nome, meu, preco, ondeEsta(opcao))}
                  aria-pressed={modelo.id === escolha.modelo.id}
                  onClick={() => onEscolher(opcao)}
                  className={`${OPCAO} text-[11px] uppercase`}
                >
                  <Miniatura escolha={opcao} />
                  {modelo.nome}
                  <Preco meu={meu} preco={preco} onde={ondeEsta(opcao)} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className={TITULO}>Cor</h2>
          <div role="group" aria-label="Cor" className="grid grid-cols-4 gap-2">
            {CORES.map((cor) => {
              const opcao = { ...escolha, cor };
              const meu = ehMeu(quarto, opcao);
              const preco = precoDe(opcao);
              return (
                <button
                  key={cor.id}
                  type="button"
                  disabled={ocupado}
                  aria-label={rotuloDa(cor.nome, meu, preco, ondeEsta(opcao))}
                  aria-pressed={cor.id === escolha.cor.id}
                  onClick={() => onEscolher(opcao)}
                  className={`${OPCAO} text-[11px]`}
                >
                  <i aria-hidden="true" className="size-6 rounded-full border-[3px] border-contorno" style={{ background: tintaDe(opcao) }} />
                  {cor.nome}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {falta ? <p className="shrink-0 px-3 text-center text-sm font-black md:px-4">{falta}</p> : null}
      {aqui ? <p className="shrink-0 px-3 text-center text-sm font-black md:px-4">Este item {aqui}. Colocar traz ele para cá.</p> : null}
      <div className="flex shrink-0 gap-2.5 px-3 pt-1 pb-3 md:px-4 md:pb-4">
        <button type="button" disabled={ocupado || !colocados.has(lugar.id)} onClick={onTirar} className={`${BOTAO_NEUTRO} flex-1`}>
          Tirar
        </button>
        <button type="button" disabled={ocupado || compra.bloqueado} onClick={(e) => onComprar(e.currentTarget)} aria-label={falta ? `Comprar por ${compra.preco} joias. ${falta}` : undefined} className={`${BOTAO_DE_COMPRA} flex-1`}>
          <RotuloDaCompra compra={compra} />
        </button>
      </div>
    </section>
  );
}
