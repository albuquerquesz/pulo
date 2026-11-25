import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';

type GavetaProps = {
  aberta: boolean;
  onFechar: () => void;
  /** Os botões redondos do topo, antes do fechar. */
  acoes: ReactNode;
  children: ReactNode;
};

export const BOTAO_DA_GAVETA =
  'grid size-[34px] cursor-pointer place-items-center rounded-full border border-line text-[13px] text-muted hover:bg-line/50 hover:text-ink';

/** Painel que entra pela direita sobre o quadro escurecido. Fica montado para animar a saída. */
export function Gaveta({ aberta, onFechar, acoes, children }: GavetaProps) {
  const painel = useRef<HTMLElement>(null);
  const fechar = useRef(onFechar);
  useLayoutEffect(() => {
    fechar.current = onFechar;
  });

  useEffect(() => {
    if (!aberta) return;
    const anterior = document.activeElement;
    painel.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar.current();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
      if (anterior instanceof HTMLElement) anterior.focus();
    };
  }, [aberta]);

  return (
    <>
      <div
        data-testid="fundo-da-gaveta"
        aria-hidden="true"
        onClick={onFechar}
        className={`fixed inset-0 z-40 bg-[rgba(10,20,15,0.45)] transition-opacity duration-200 ${aberta ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      <aside
        ref={painel}
        role={aberta ? 'dialog' : undefined}
        aria-modal={aberta ? true : undefined}
        aria-label="Detalhe da tarefa"
        inert={!aberta}
        tabIndex={-1}
        className={`fixed inset-y-0 right-0 z-[41] flex w-full flex-col border-line bg-bg outline-none transition-[translate,visibility] duration-250 ease-[ease] md:w-[min(1000px,94vw)] md:border-l ${
          aberta ? 'visible translate-x-0 shadow-[-20px_0_50px_rgba(0,0,0,0.35)]' : 'invisible translate-x-[102%]'
        }`}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="ml-auto flex gap-1.5">
            {acoes}
            <button type="button" onClick={onFechar} aria-label="Fechar" title="Fechar" className={BOTAO_DA_GAVETA}>
              ✕
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto md:grid md:grid-cols-[minmax(0,1fr)_250px]">{children}</div>
      </aside>
    </>
  );
}
