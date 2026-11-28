import type { ReactNode } from 'react';

import { CARTAO } from './estilos';

/** O cartão com as linhas de uma seção. Estica para as colunas terem a mesma altura. */
export function Linhas({ children }: { children: ReactNode }) {
  return <div className={`${CARTAO} flex-1 divide-y divide-dashed divide-line px-5 py-1`}>{children}</div>;
}

type LinhaProps = { titulo: string; detalhe?: string; perigo?: boolean; children: ReactNode };

/** Uma linha do cartão (`.linha`): o nome à esquerda e o controle à direita. */
export function Linha({ titulo, detalhe, perigo = false, children }: LinhaProps) {
  return (
    <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3.5">
      <span className={`min-w-0 flex-1 font-extrabold ${perigo ? 'text-perigo-texto' : ''}`}>
        {titulo}
        {detalhe ? <small className="mt-0.5 block text-[13px] font-semibold text-muted">{detalhe}</small> : null}
      </span>
      {children}
    </div>
  );
}

export { Escolha } from '@/ui';
