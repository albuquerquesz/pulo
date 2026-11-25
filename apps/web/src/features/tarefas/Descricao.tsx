import { useLayoutEffect, useRef, useState } from 'react';

import { TASKS } from '@pulo/core/config/decisions';

import { useTextoAdiado } from './useTextoAdiado';

/** Descrição sem caixa: só o texto, que cresce junto. */
export function Descricao({ valor, onGravar }: { valor: string; onGravar: (texto: string) => void }) {
  const campo = useRef<HTMLTextAreaElement>(null);
  const [texto, setTexto] = useState(valor);
  const adiado = useTextoAdiado(onGravar);

  useLayoutEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [texto]);

  return (
    <textarea
      ref={campo}
      rows={1}
      aria-label="Descrição"
      placeholder="Adicionar descrição…"
      maxLength={TASKS.descriptionMaxChars}
      value={texto}
      onChange={(e) => {
        setTexto(e.target.value);
        adiado.digitar(e.target.value);
      }}
      onBlur={adiado.agora}
      className="min-h-10 w-full flex-none resize-none overflow-hidden bg-transparent text-base leading-[1.55] font-semibold outline-none placeholder:text-muted placeholder:opacity-70"
    />
  );
}
