import { useState } from 'react';

import { TASKS } from '@pulo/core/config/decisions';

type CampoNovoProps = {
  rotulo: string;
  placeholder: string;
  /** Enter com texto: grava, e o campo continua aberto para o próximo. `false`: não gravou, e o texto volta. */
  onSalvar: (titulo: string) => Promise<boolean>;
  /** Esc, ou sair do campo sem ter escrito nada. */
  onFechar: () => void;
};

/** O campo que abre no lugar do botão de adicionar tarefa ou subtarefa. */
export function CampoNovo({ rotulo, placeholder, onSalvar, onFechar }: CampoNovoProps) {
  const [texto, setTexto] = useState('');
  const salvar = async (titulo: string) => {
    setTexto('');
    // O que a pessoa já escreveu depois fica como está.
    if (!(await onSalvar(titulo))) setTexto((atual) => atual || titulo);
  };
  return (
    <input
      autoFocus
      aria-label={rotulo}
      placeholder={placeholder}
      maxLength={TASKS.titleMaxChars}
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => {
        if (!texto.trim()) onFechar();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing && texto.trim()) {
          e.preventDefault();
          void salvar(texto.trim());
        }
        if (e.key === 'Escape') {
          // Só fecha o campo, não a gaveta.
          e.stopPropagation();
          onFechar();
        }
      }}
      className="w-full rounded-[8px] border border-line bg-transparent px-2.5 py-2 text-base outline-none focus:border-sapo md:text-sm"
    />
  );
}
