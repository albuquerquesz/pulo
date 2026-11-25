import { useLayoutEffect, useRef } from 'react';

import { useTextoAdiado } from './useTextoAdiado';

type TextoEditavelProps = {
  valor: string;
  rotulo: string;
  maximo: number;
  /** Só chega texto com conteúdo: apagar tudo devolve o anterior ao sair do campo. */
  onGravar: (texto: string) => void;
  className: string;
};

/** Texto que se edita no lugar, sem caixa (o `contenteditable` do rascunho). Enter termina a edição. */
export function TextoEditavel({ valor, rotulo, maximo, onGravar, className }: TextoEditavelProps) {
  const campo = useRef<HTMLDivElement>(null);
  const adiado = useTextoAdiado((texto) => {
    const limpo = texto.trim().slice(0, maximo);
    if (limpo && limpo !== valor) onGravar(limpo);
  });

  // O React não pode reescrever o conteúdo enquanto a pessoa digita (o cursor voltaria ao começo).
  useLayoutEffect(() => {
    const el = campo.current;
    if (el && el !== document.activeElement && el.textContent !== valor) el.textContent = valor;
  }, [valor]);

  return (
    <div
      ref={campo}
      role="textbox"
      aria-label={rotulo}
      tabIndex={0}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck={false}
      onInput={(e) => adiado.digitar(e.currentTarget.textContent ?? '')}
      onBlur={(e) => {
        adiado.agora();
        if (!e.currentTarget.textContent?.trim()) e.currentTarget.textContent = valor;
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        e.currentTarget.blur();
      }}
      className={`min-w-0 break-words outline-none focus-visible:underline focus-visible:decoration-sapo focus-visible:underline-offset-4 ${className}`}
    />
  );
}
