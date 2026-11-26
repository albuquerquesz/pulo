import type { ReactNode } from 'react';

export type BotaoCantoProps = {
  /** Emoji ou SVG do meio do botão. */
  icone: ReactNode;
  /** Nome do botão (acessibilidade e dica). */
  rotulo: string;
  /** Texto curto embaixo do quadrado. */
  legenda?: string;
  onPress?: () => void;
  /** Quadrado menor, como o de tela cheia (`.expandir`). */
  pequeno?: boolean;
  desativado?: boolean;
  /** Motivo do bloqueio: vira a dica do botão desativado. */
  dica?: string;
  /** `id` do texto na tela que explica o botão. */
  descritoPor?: string;
};

/** Botão quadrado de contorno grosso dos cantos das cenas (`.bt-canto`). */
export function BotaoCanto({ icone, rotulo, legenda, onPress, pequeno = false, desativado = false, dica, descritoPor }: BotaoCantoProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={desativado}
      title={desativado && dica ? dica : rotulo}
      aria-describedby={descritoPor}
      aria-label={rotulo}
      className="group flex cursor-pointer flex-col disabled:cursor-not-allowed disabled:opacity-45 items-center gap-1 text-[13px] font-black tracking-wider text-contorno uppercase"
    >
      <span
        aria-hidden="true"
        className={`grid ${pequeno ? 'size-[52px] rounded-2xl' : 'size-16 rounded-[20px]'} place-items-center border-4 border-contorno bg-white text-[30px] shadow-[inset_0_-5px_0_var(--pulo-sombra-branca)] group-enabled:group-hover:-translate-y-0.5`}
      >
        {icone}
      </span>
      {legenda}
    </button>
  );
}
