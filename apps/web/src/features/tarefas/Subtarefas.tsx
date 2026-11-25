import { useState } from 'react';

import { TASKS } from '@pulo/core/config/decisions';
import type { TaskSubtask } from '@pulo/core/domain/types';

import { TextoEditavel } from './TextoEditavel';

type SubtarefasProps = {
  subtarefas: TaskSubtask[];
  onMarcar: (subtarefa: TaskSubtask, feita: boolean) => void;
  onRenomear: (subtarefa: TaskSubtask, titulo: string) => void;
  onRemover: (subtarefa: TaskSubtask) => void;
  onAdicionar: (titulo: string) => void;
};

export function Subtarefas({ subtarefas, onMarcar, onRenomear, onRemover, onAdicionar }: SubtarefasProps) {
  const [escrevendo, setEscrevendo] = useState(false);
  const [nova, setNova] = useState('');
  const total = subtarefas.length;
  const feitas = subtarefas.filter((s) => s.done).length;
  return (
    <div className="flex flex-col gap-0.5 border-b border-line pb-5">
      {total ? (
        <div className="mb-1.5 flex items-center gap-2.5 text-sm">
          <b>Subtarefas</b>
          <span className="rounded-[8px] border border-line px-2 py-px text-xs">
            {feitas}/{total}
          </span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-line/70">
            <i className="block h-full bg-sapo" style={{ width: `${(feitas / total) * 100}%` }} />
          </div>
        </div>
      ) : null}
      {subtarefas.map((s) => (
        <div key={s.id} className="group flex items-center gap-2.5 rounded-[8px] px-2 py-[7px] text-[15px] hover:bg-line/40">
          <input
            type="checkbox"
            aria-label={`Marcar ${s.title}`}
            checked={s.done}
            onChange={(e) => onMarcar(s, e.target.checked)}
            className="size-4 flex-none accent-sapo"
          />
          <TextoEditavel
            valor={s.title}
            rotulo="Nome da subtarefa"
            maximo={TASKS.titleMaxChars}
            onGravar={(titulo) => onRenomear(s, titulo)}
            className={`flex-1 ${s.done ? 'text-muted line-through' : ''}`}
          />
          <button
            type="button"
            aria-label={`Remover ${s.title}`}
            onClick={() => onRemover(s)}
            className="cursor-pointer px-1 text-muted group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
      {total >= TASKS.maxSubtasks ? null : escrevendo ? (
        <input
          autoFocus
          aria-label="Nova subtarefa"
          placeholder="Nome da subtarefa e Enter"
          maxLength={TASKS.titleMaxChars}
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && nova.trim()) {
              e.preventDefault();
              onAdicionar(nova.trim());
              setNova('');
            }
            if (e.key === 'Escape') {
              // Só fecha o campo, não a gaveta.
              e.stopPropagation();
              setEscrevendo(false);
              setNova('');
            }
          }}
          className="mt-1 w-full rounded-[8px] border border-line bg-transparent px-2.5 py-2 outline-none focus:border-sapo"
        />
      ) : (
        <button type="button" onClick={() => setEscrevendo(true)} className="cursor-pointer self-start px-2 py-1.5 text-sm font-bold text-muted hover:text-ink">
          + Adicionar subtarefas
        </button>
      )}
    </div>
  );
}
