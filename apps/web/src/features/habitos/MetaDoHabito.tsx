import { useState, type ReactNode } from 'react';

import type { EntityId, Goal, GoalChest, Habit } from '@pulo/core/domain/types';
import { FUNDO_DA_COR } from '@/ui';

import { metaNaTela } from '../casca/logic';
import { CARTAO } from '../hoje/estilos';
import { ProgressoDaMeta } from '../metas/ProgressoDaMeta';
import { BOTAO_FANTASMA, ICONE } from './estilos';

type OpcaoProps = { grupo: string; marcada: boolean; onEscolher: () => void; children: ReactNode };

function Opcao({ grupo, marcada, onEscolher, children }: OpcaoProps) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 hover:bg-surface has-focus-visible:outline-2 has-focus-visible:outline-sapo-borda ${marcada ? 'bg-surface shadow-[inset_0_0_0_2px_var(--pulo-sapo)]' : ''}`}
    >
      <input type="radio" name={grupo} checked={marcada} onChange={onEscolher} className="sr-only" />
      <span aria-hidden="true" className={`size-5 shrink-0 rounded-full ${marcada ? 'border-[6px] border-sapo' : 'border-2 border-muted'}`} />
      {children}
    </label>
  );
}

type MetaDoHabitoProps = {
  habito: Habit;
  metas: readonly Goal[];
  baus: readonly GoalChest[];
  onTrocar: (goalId: EntityId | null) => void;
  onVerMeta: (goalId: EntityId) => void;
};

/** A meta atrelada com barra e baú, e a lista para trocar (`.meta-at`). Sem meta, a lista já vem aberta. */
export function MetaDoHabito({ habito, metas, baus, onTrocar, onVerMeta }: MetaDoHabitoProps) {
  const [trocando, setTrocando] = useState(false);
  const atual = metas.find((m) => m.id === habito.goalId);
  const meta = atual ? metaNaTela(atual, baus) : null;
  const escolher = (id: EntityId | null) => {
    setTrocando(false);
    onTrocar(id);
  };
  const grupo = `meta-de-${habito.id}`;
  return (
    <div className={`${CARTAO} flex flex-col gap-3.5 p-5`}>
      {meta ? (
        <>
          <div className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3.5">
            <span aria-hidden="true" className={`${ICONE} size-12 rounded-[14px] text-2xl ${FUNDO_DA_COR[meta.cor]}`}>
              {meta.icone}
            </span>
            <div>
              <b className="mb-1.5 block">{meta.titulo}</b>
              <ProgressoDaMeta meta={meta} bau="-my-3.5 -mr-1 size-12" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-expanded={trocando} onClick={() => setTrocando(!trocando)} className={`${BOTAO_FANTASMA} px-3.5 py-2 text-[13px]`}>
              Trocar meta
            </button>
            <button type="button" onClick={() => onVerMeta(meta.id)} className={`${BOTAO_FANTASMA} px-3.5 py-2 text-[13px]`}>
              Ver meta
            </button>
          </div>
        </>
      ) : (
        <p className="text-muted">Esse hábito ainda não empurra nenhuma meta.</p>
      )}
      {trocando || !meta ? (
        <div role="radiogroup" aria-label="Meta do hábito" className="flex flex-col gap-1.5 rounded-sm bg-line/40 p-2.5">
          {metas
            .filter((m) => m.state === 'ativa')
            .map((m) => {
              const opcao = metaNaTela(m, baus);
              return (
                <Opcao key={m.id} grupo={grupo} marcada={m.id === habito.goalId} onEscolher={() => escolher(m.id)}>
                  <span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-[10px] ${FUNDO_DA_COR[opcao.cor]}`}>
                    {opcao.icone}
                  </span>
                  <b>{opcao.titulo}</b>
                </Opcao>
              );
            })}
          <Opcao grupo={grupo} marcada={!meta} onEscolher={() => escolher(null)}>
            <span className="text-muted">Sem meta</span>
          </Opcao>
        </div>
      ) : null}
    </div>
  );
}
