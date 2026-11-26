import { useState, type ReactNode } from 'react';

import type { TaskStatus } from '@pulo/core/domain/types';

import { cartaoAbaixo, type Coluna } from './logic';

const PONTO: Record<TaskStatus, string> = {
  ideias: 'bg-muted',
  afazer: 'bg-sol',
  fazendo: 'bg-agua',
  feito: 'bg-sapo',
};

type ColunaProps = {
  coluna: Coluna;
  onNova: () => void;
  /** Soltaram um cartão aqui, antes de `antesDe` (ou no fim). */
  onSoltar: (antesDe: string | undefined) => void;
  children: ReactNode;
};

export function ColunaDoQuadro({ coluna, onNova, onSoltar, children }: ColunaProps) {
  const [alvo, setAlvo] = useState(false);
  return (
    <section
      aria-label={coluna.nome}
      onDragOver={(e) => {
        e.preventDefault();
        setAlvo(true);
      }}
      onDragLeave={(e) => {
        if (!(e.relatedTarget instanceof Node) || !e.currentTarget.contains(e.relatedTarget)) setAlvo(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setAlvo(false);
        const cartoes = [...e.currentTarget.querySelectorAll('[data-tarefa]')].map((el) => {
          const caixa = el.getBoundingClientRect();
          return { id: el.getAttribute('data-tarefa') ?? '', meio: caixa.top + caixa.height / 2 };
        });
        onSoltar(cartaoAbaixo(cartoes, e.clientY));
      }}
      className={`group flex min-w-0 flex-col gap-2.5 rounded-md border p-3.5 transition-colors duration-150 md:min-h-[300px] ${
        alvo ? 'border-sapo bg-[color-mix(in_srgb,var(--pulo-sapo)_10%,var(--pulo-surface))]' : 'border-line bg-surface/55'
      }`}
    >
      <div className="flex items-center gap-2 px-1 pt-0.5 pb-1.5">
        <span aria-hidden="true" className={`size-2.5 rounded-full ${PONTO[coluna.status]}`} />
        <h2 className="text-[15px] font-extrabold">{coluna.nome}</h2>
        <span className="rounded-full bg-line/70 px-[9px] py-px text-xs font-extrabold text-muted">{coluna.tarefas.length}</span>
        <button
          type="button"
          onClick={onNova}
          aria-label={`Adicionar tarefa em ${coluna.nome}`}
          title="Adicionar tarefa"
          className="ml-auto grid size-7 cursor-pointer place-items-center rounded-[9px] pb-0.5 text-xl leading-none font-extrabold text-muted transition-opacity duration-150 hover:bg-sapo/16 hover:text-ink focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
        >
          +
        </button>
      </div>
      {children}
      <button
        type="button"
        onClick={onNova}
        className="mt-auto cursor-pointer rounded-[12px] border-[1.5px] border-dashed border-line p-2.5 font-extrabold text-muted hover:border-sapo hover:text-ink"
      >
        + Adicionar
      </button>
    </section>
  );
}
