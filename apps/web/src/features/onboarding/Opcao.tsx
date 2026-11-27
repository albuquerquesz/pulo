import type { ReactNode } from 'react';

type OpcaoProps = {
  marcada: boolean;
  onEscolher: () => void;
  desativada?: boolean;
  /** `linha`: ícone ao lado do texto. `coluna`: tudo centralizado, para grades. */
  formato?: 'linha' | 'coluna';
  children: ReactNode;
};

const FORMATO = {
  linha: 'items-center gap-3 px-3.5 py-3 text-left',
  coluna: 'flex-col items-center justify-center gap-1 px-2 py-3.5 text-center',
};

/** Resposta de um clique; marcada fica lima. */
export function Opcao({ marcada, onEscolher, desativada = false, formato = 'coluna', children }: OpcaoProps) {
  return (
    <button
      type="button"
      aria-pressed={marcada}
      disabled={desativada}
      onClick={onEscolher}
      className={`flex min-w-0 cursor-pointer rounded-[18px] border-[3px] border-contorno bg-surface text-base font-extrabold shadow-[inset_0_-4px_0_var(--pulo-sombra-branca)] transition-[translate,background-color] enabled:active:translate-y-0.5 enabled:not-aria-pressed:hover:bg-[#fffbef] disabled:cursor-not-allowed disabled:opacity-45 aria-pressed:bg-lima-forte aria-pressed:shadow-[inset_0_-4px_0_#9fb43a] ${FORMATO[formato]}`}
    >
      {children}
    </button>
  );
}
