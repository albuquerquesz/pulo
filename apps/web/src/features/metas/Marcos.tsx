import { useState } from 'react';

import { GOALS } from '@pulo/core/config/decisions';
import { goalProgress } from '@pulo/core/domain/goals';
import type { EntityId, Goal } from '@pulo/core/domain/types';

import { CARTAO, LEGENDA, TITULO } from '../hoje/estilos';
import { CABECALHO_DA_SECAO } from './estilos';
import { dataCurta } from './logic';

const CIRCULO = 'grid size-6 shrink-0 place-items-center rounded-full border-[2.5px] text-[13px]';
const LINHA = 'flex min-h-12 w-full cursor-pointer items-center gap-3.5 py-3 text-left';

type MarcosProps = {
  meta: Goal;
  timeZone: string;
  onAlternar: (id: EntityId) => void;
  /** Devolve `false` quando não gravou; o texto fica no campo. */
  onAdicionar: (titulo: string) => Promise<boolean>;
};

/** Os marcos riscáveis, com o próximo destacado, e a linha de adicionar. */
export function Marcos({ meta, timeZone, onAlternar, onAdicionar }: MarcosProps) {
  const [escrevendo, setEscrevendo] = useState(false);
  const [titulo, setTitulo] = useState('');
  const { done, total } = goalProgress(meta);
  const proximo = meta.milestones.find((m) => m.doneAt === undefined)?.id;

  const adicionar = async () => {
    if (!titulo.trim()) return setEscrevendo(false);
    if (await onAdicionar(titulo)) setTitulo('');
  };

  return (
    <section aria-label="Marcos" className="flex flex-col gap-3">
      <div className={CABECALHO_DA_SECAO}>
        <h3 className={TITULO}>Marcos</h3>
        <span className={LEGENDA}>
          {done} de {total}
        </span>
      </div>
      <ul className={`${CARTAO} flex flex-col px-5 py-2`}>
        {meta.milestones.map((m) => {
          const feito = m.doneAt !== undefined;
          const eOProximo = m.id === proximo;
          return (
            <li key={m.id} className="border-b border-line">
              <button type="button" role="checkbox" aria-checked={feito} aria-label={m.title} onClick={() => onAlternar(m.id)} className={LINHA}>
                <span
                  aria-hidden="true"
                  className={`${CIRCULO} ${feito ? 'border-sapo-borda bg-sapo text-ink-sobre-acao' : eOProximo ? 'border-sapo' : 'border-muted'}`}
                >
                  {feito ? '✓' : ''}
                </span>
                <span className={feito ? 'text-muted line-through' : ''}>{m.title}</span>
                <span className={`ml-auto shrink-0 text-[13px] ${eOProximo ? 'font-extrabold text-sapo-borda' : 'text-muted'}`}>
                  {m.doneAt !== undefined ? dataCurta(m.doneAt, timeZone) : eOProximo ? 'próximo' : ''}
                </span>
              </button>
            </li>
          );
        })}
        {total >= GOALS.maxMilestones ? null : (
          <li className="text-muted">
            {escrevendo ? (
              <form
                className="flex items-center gap-3.5 py-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void adicionar();
                }}
              >
                <span aria-hidden="true" className={`${CIRCULO} border-dashed border-muted`} />
                <input
                  autoFocus
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  onBlur={() => {
                    if (!titulo.trim()) setEscrevendo(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setTitulo('');
                      setEscrevendo(false);
                    }
                  }}
                  aria-label="Nome do novo marco"
                  placeholder="Nome do marco"
                  className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted"
                />
                <button type="submit" className="min-h-11 shrink-0 cursor-pointer text-[13px] font-extrabold text-sapo-borda">
                  Adicionar
                </button>
              </form>
            ) : (
              <button type="button" onClick={() => setEscrevendo(true)} className={LINHA}>
                <span aria-hidden="true" className={`${CIRCULO} border-dashed border-muted`} />
                Adicionar marco
              </button>
            )}
          </li>
        )}
      </ul>
    </section>
  );
}
