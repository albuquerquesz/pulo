import type { ReactNode } from 'react';

export type BarraValorProps = {
  /** Ícone que vaza pela esquerda (uma `Joia` grande ou um SVG de 58 px). */
  icone: ReactNode;
  valor: ReactNode;
  /** O que o número é, para leitores de tela (ex.: "joias"). */
  rotulo: string;
  /** Com ele, aparece o botão + à direita. */
  onMais?: () => void;
  rotuloMais?: string;
};

/** Barra branca de contorno grosso do topo da Casa e da Ilha (`.vbar`). */
export function BarraValor({ icone, valor, rotulo, onMais, rotuloMais = 'Ganhar mais' }: BarraValorProps) {
  return (
    <div className="relative flex h-11 min-w-[112px] md:min-w-[200px] items-center rounded-full border-4 border-contorno bg-white pr-[50px] pl-16 shadow-[0_4px_0_rgba(59,42,47,0.25)]">
      <span aria-hidden="true" className="contorno-grosso absolute top-1/2 -left-[22px] grid size-[62px] -translate-y-1/2 -rotate-8 place-items-center">
        {icone}
      </span>
      <b className="flex-1 text-right text-[22px] font-black text-contorno tabular-nums">
        {valor}
        <span className="sr-only"> {rotulo}</span>
      </b>
      {onMais ? (
        <button
          type="button"
          onClick={onMais}
          aria-label={rotuloMais}
          className="absolute top-1/2 -right-2 grid size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-4 border-contorno bg-lima pb-[3px] text-2xl leading-none font-black text-contorno"
        >
          +
        </button>
      ) : null}
    </div>
  );
}
