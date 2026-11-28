import type { ReactNode } from 'react';

export const BOTAO_DO_VAZIO =
  'mt-2 cursor-pointer rounded-md bg-sapo px-5 py-2.5 font-extrabold text-ink-sobre-acao shadow-[inset_0_-4px_0_var(--pulo-sapo-borda)] active:translate-y-[3px]';

type VazioProps = { icone: string; titulo: string; texto: string; children: ReactNode };

/** Vazio mostra o caminho, não o aviso: ícone, uma frase e o botão de agir, como no cartão de Metas. */
export function Vazio({ icone, titulo, texto, children }: VazioProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <span aria-hidden="true" className="mb-1 grid size-14 place-items-center rounded-full bg-sapo/22 text-[28px]">
        {icone}
      </span>
      <h3 className="text-base font-extrabold">{titulo}</h3>
      <p className="text-sm text-muted">{texto}</p>
      {children}
    </div>
  );
}
