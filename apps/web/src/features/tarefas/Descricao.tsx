import { useLayoutEffect, useRef, useState } from 'react';

import { TASKS } from '@pulo/core/config/decisions';

import { useTextoAdiado } from './useTextoAdiado';

/** Descrição sem caixa: só o texto, que cresce junto. */
export function Descricao({ valor, onGravar }: { valor: string; onGravar: (texto: string) => void }) {
  const campo = useRef<HTMLTextAreaElement>(null);
  const [texto, setTexto] = useState(valor);
  const [editando, setEditando] = useState(false);
  const [visto, setVisto] = useState(valor);
  // O valor mudou por fora (outra gravação, ou voltou atrás): o campo acompanha, menos durante a digitação.
  if (!editando && valor !== visto) {
    setVisto(valor);
    setTexto(valor);
  }
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
      onFocus={() => setEditando(true)}
      onBlur={() => {
        setEditando(false);
        // Marca o valor atual como visto, para o que acabou de ser digitado não ser trocado pelo antigo.
        setVisto(valor);
        adiado.agora();
      }}
      className="min-h-10 w-full flex-none resize-none overflow-hidden bg-transparent text-base leading-[1.55] font-semibold outline-none placeholder:text-muted placeholder:opacity-70"
    />
  );
}
