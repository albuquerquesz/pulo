import { useRef, type ReactNode } from 'react';

import { BotaoFechar } from './BotaoFechar';
import { useDialogo } from './useDialogo';

export type ModalProps = {
  aberto: boolean;
  /** Esc ou clique no fundo. */
  onFechar: () => void;
  /** Nome do diálogo para leitores de tela. */
  rotulo: string;
  children: ReactNode;
  /** Cobre só o pai (que precisa de `relative`), como na cena do quarto; sem isto, a tela toda. */
  contido?: boolean;
  /** Fica acima de outro diálogo ou gaveta (as confirmações). */
  porCima?: boolean;
};

/** Diálogo com moldura de madeira (`.dm-moldura` e `.dm-folha`). */
export function Modal({ aberto, onFechar, rotulo, children, contido = false, porCima = false }: ModalProps) {
  const moldura = useRef<HTMLDivElement>(null);
  const folha = useRef<HTMLDivElement>(null);
  useDialogo({ aberto, onFechar, caixa: moldura, foco: folha });

  if (!aberto) return null;
  return (
    <div className={`${contido ? 'absolute' : 'fixed'} inset-0 ${porCima ? 'z-50' : 'z-30'} flex flex-col items-center justify-center gap-[18px] p-4`}>
      <div data-testid="fundo-do-modal" aria-hidden="true" onClick={onFechar} className="absolute inset-0 bg-[rgba(36,28,32,0.55)]" />
      <div ref={moldura} className="relative w-full max-w-[560px] rounded-[26px] border-4 border-contorno bg-madeira-clara p-2 md:p-3.5 shadow-[0_12px_0_rgba(59,42,47,0.3)]">
        <div
          ref={folha}
          role="dialog"
          aria-modal="true"
          aria-label={rotulo}
          tabIndex={-1}
          className={`flex min-h-[min(360px,calc(100dvh-8rem))] max-h-[calc(100dvh-8rem)] flex-col items-center justify-center-safe gap-5 overflow-auto rounded-2xl border-4 border-contorno bg-folha px-3 pt-4 pb-4 text-contorno folha-clara md:px-[22px] md:pt-6 md:pb-5`}
        >
          {children}
        </div>
        {/* Dentro de um quadro (contido), o X fica para dentro, senão a borda corta. */}
        <BotaoFechar onFechar={onFechar} className={contido ? 'top-1 right-1' : '-top-4 -right-4'} />
      </div>
    </div>
  );
}
