import type { ReactNode } from 'react';

import { Modal } from '@/ui';

export const BOTAO_DO_DIALOGO =
  'min-h-11 cursor-pointer rounded-[14px] border-[3px] border-contorno px-5 py-2 font-black text-contorno disabled:cursor-not-allowed disabled:opacity-50';

type DialogoProps = {
  titulo: string;
  onFechar: () => void;
  /** Desenho acima do título. */
  ilustracao?: ReactNode;
  children: ReactNode;
};

/** Os diálogos do Perfil: a moldura de madeira com um título. */
export function Dialogo({ titulo, onFechar, ilustracao, children }: DialogoProps) {
  return (
    <Modal aberto onFechar={onFechar} rotulo={titulo}>
      {ilustracao}
      <h2 className="text-xl font-black">{titulo}</h2>
      {children}
    </Modal>
  );
}
