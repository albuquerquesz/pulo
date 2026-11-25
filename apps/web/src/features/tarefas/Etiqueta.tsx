import type { ReactNode } from 'react';

import { corDaEtiqueta } from './logic';

export const CHIP = 'inline-flex items-center gap-1.5 rounded-[8px] border border-line px-[9px] py-[3px] text-[13px] font-bold';

export function Etiqueta({ nome, children }: { nome: string; children?: ReactNode }) {
  return (
    <span className={CHIP}>
      <i aria-hidden="true" className={`size-2 rounded-full ${corDaEtiqueta(nome)}`} />
      {nome}
      {children}
    </span>
  );
}
