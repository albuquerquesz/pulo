import type { ComodoDaCasa } from '@pulo/core/domain/casa';
import type { RoomDecor } from '@pulo/core/domain/types';
import { Joia, Modal } from '@/ui';

import { CartaoDoGelo } from '../casca/CartaoDoGelo';
import { COR_NATURAL, CORES, idDaCompra, ITENS, precoDe, type Escolha } from './catalogo';
import { colocadosNoQuarto, ehMeu, estadoDaCompra, type EstadoDaCompra } from './decoracao';
import type { Lugar } from './lugares';
import { VisualDoItem } from './VisualDoItem';

export const BOTAO_DA_LOJA =
  'cursor-pointer rounded-[14px] border-4 border-contorno px-3.5 py-3 font-black tracking-wide text-contorno uppercase disabled:cursor-not-allowed disabled:opacity-50';
export const BOTAO_NEUTRO = `${BOTAO_DA_LOJA} bg-bege shadow-[inset_0_-5px_0_var(--pulo-bege-borda)]`;
export const BOTAO_DE_COMPRA = `${BOTAO_DA_LOJA} bg-lima-clara shadow-[inset_0_-5px_0_var(--pulo-lima)]`;

const TEXTO_DA_ACAO = { colocar: 'Colocar', no_lugar: 'No lugar', ja_e_seu: 'Já é seu', em_breve: 'Em breve' } as const;

export function RotuloDaCompra({ compra }: { compra: EstadoDaCompra }) {
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

export type LojaModalProps = {
  /** `null`: loja aberta pelo botão de canto, com todos os tipos. */
  lugar: Lugar | null;
  escolha: Escolha;
  quarto: readonly RoomDecor[];
  saldo: number;
  /** O cômodo que está sendo decorado. */
  comodo: ComodoDaCasa;
  onEscolher: (escolha: Escolha) => void;
  onVer: () => void;
  onComprar: () => void;
  onTirar: () => void;
  onCancelar: () => void;
};

export function LojaModal({ lugar, escolha, quarto, saldo, comodo, onEscolher, onVer, onComprar, onTirar, onCancelar }: LojaModalProps) {
  const tipos = ITENS.filter((i) => !lugar || i.tipo === lugar.tipo);
  const compra = estadoDaCompra({ quarto, saldo, lugar, escolha, comodo: comodo.id });
  const ocupado = lugar !== null && colocadosNoQuarto(quarto, comodo.id).some((c) => c.lugar.id === lugar.id);
  return (
    <Modal
      aberto
      contido
      onFechar={onCancelar}
      rotulo={`${lugar ? 'Decorar' : 'Loja'}: ${comodo.nome}`}
    >
      {lugar ? null : <CartaoDoGelo />}
      <div className="flex shrink-0 flex-col items-center justify-end gap-2 md:min-h-[130px]">
        <span className="origin-bottom max-md:[zoom:0.65]">
          <VisualDoItem {...escolha} tamanho={96} />
        </span>
        <b className="text-center text-[15px] font-black tracking-wider uppercase">
          {escolha.item.nome} · {escolha.cor.nome}
        </b>
      </div>
      {tipos.length > 1 ? (
        <div role="group" aria-label="Tipo de item" className="flex flex-wrap justify-center gap-2.5">
          {tipos.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === escolha.item.id}
              onClick={() => onEscolher({ item, cor: COR_NATURAL })}
              className="flex w-[84px] cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-4 border-contorno bg-creme px-0.5 pt-2 pb-1.5 text-[10px] font-black uppercase aria-pressed:bg-lima-forte md:w-24 md:px-1.5 md:pt-3 md:pb-2 md:text-xs"
            >
              <VisualDoItem item={item} cor={COR_NATURAL} tamanho={38} />
              <span>{item.nome}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div role="group" aria-label="Cor" className="grid w-full grid-cols-4 gap-2.5">
        {CORES.map((cor) => {
          const opcao = { item: escolha.item, cor };
          const meu = ehMeu(quarto, opcao);
          const vendida = meu || idDaCompra(opcao) !== null;
          const preco = precoDe(opcao);
          return (
            <button
              key={cor.id}
              type="button"
              title={cor.nome}
              aria-label={`${cor.nome}, ${meu ? 'já é seu' : vendida ? `${preco} joias` : 'em breve'}`}
              aria-pressed={cor.id === escolha.cor.id}
              onClick={() => onEscolher(opcao)}
              className="relative flex cursor-pointer flex-col items-center gap-1.5 rounded-[14px] border-4 border-contorno bg-creme px-1.5 pt-2 pb-2.5 aria-pressed:bg-lima-forte"
            >
              <span className="inline-flex items-center gap-[3px] self-start text-[13px] font-black md:text-[15px]">
                {meu ? (
                  '✓ seu'
                ) : vendida ? (
                  <>
                    <Joia />
                    {preco}
                  </>
                ) : (
                  'em breve'
                )}
              </span>
              <VisualDoItem {...opcao} tamanho={34} />
            </button>
          );
        })}
      </div>
      <div className="flex w-full justify-between gap-3.5">
        {lugar ? (
          <button type="button" onClick={onVer} className={`${BOTAO_NEUTRO} flex-1 text-[15px] md:text-[17px]`}>
            Ver no quarto
          </button>
        ) : null}
        <button type="button" disabled={compra.bloqueado} onClick={onComprar} className={`${BOTAO_DE_COMPRA} flex-1 text-[15px] md:text-[17px]`}>
          <RotuloDaCompra compra={compra} />
        </button>
      </div>
      {ocupado ? (
        <button type="button" onClick={onTirar} className="cursor-pointer font-black tracking-wider text-cancelar-borda uppercase">
          Tirar daqui
        </button>
      ) : null}
    </Modal>
  );
}
