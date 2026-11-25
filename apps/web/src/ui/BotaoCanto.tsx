import type { ReactNode } from 'react';

export type BotaoCantoProps = {
  /** Emoji ou SVG do meio do botão. */
  icone: ReactNode;
  /** Nome do botão (acessibilidade e dica). */
  rotulo: string;
  /** Texto curto embaixo do quadrado. */
  legenda?: string;
  onPress?: () => void;
};

/** Botão quadrado de contorno grosso dos cantos das cenas (`.bt-canto`). */
export function BotaoCanto({ icone, rotulo, legenda, onPress }: BotaoCantoProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      title={rotulo}
      aria-label={rotulo}
      className="group flex cursor-pointer flex-col items-center gap-1 text-[13px] font-black tracking-wider text-contorno uppercase"
    >
      <span
        aria-hidden="true"
        className="grid size-16 place-items-center rounded-[20px] border-4 border-contorno bg-white text-[30px] shadow-[inset_0_-5px_0_var(--pulo-sombra-branca)] group-hover:-translate-y-0.5"
      >
        {icone}
      </span>
      {legenda}
    </button>
  );
}
