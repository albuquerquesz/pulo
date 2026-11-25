import { useState } from 'react';

import { verEstatisticasDoHabito } from '@pulo/core/domain/habit-stats';
import type { DateKey, EntityId, Goal, Habit, HabitLog } from '@pulo/core/domain/types';
import { Foguinho } from '@/ui';

import { useApp, useCarregar } from '../app';
import { textoDaFrequencia } from '../habitos/logic';
import { CARTAO, LEGENDA, TITULO } from '../hoje/estilos';
import { CABECALHO_DA_SECAO } from './estilos';
import { habitosSoltos, semanaDoHabito } from './logic';

const OPCAO = 'flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 hover:bg-surface';

type LinhaProps = { habito: Habit; semana: boolean[] };

function Linha({ habito, semana }: LinhaProps) {
  const { repo, clock } = useApp();
  // Cada linha carrega a própria sequência: no remoto ela vem do servidor, e a lista não pode esperar.
  const { estado } = useCarregar(() => verEstatisticasDoHabito(repo, habito.id, clock));
  const sequencia = estado.tipo === 'ok' ? estado.dados?.sequencia : undefined;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3.5 border-b border-line py-3">
      <div className="min-w-0">
        <b className="block">{habito.title}</b>
        <p className={LEGENDA}>
          {textoDaFrequencia(habito.weekdays)}
          {habito.state === 'pausado' ? ' · pausado' : ''}
        </p>
      </div>
      <span role="img" aria-label={`Feito em ${semana.filter(Boolean).length} dias desta semana`} className="flex gap-1">
        {semana.map((feito, i) => (
          <i key={i} data-feito={feito} className={`size-2.5 rounded-full ${feito ? 'bg-sapo' : 'bg-line'}`} />
        ))}
      </span>
      <span title="dias seguidos" className="inline-flex items-center gap-0.5 text-[13px] font-extrabold tabular-nums">
        <Foguinho className="size-4" />
        {sequencia ?? '—'}
      </span>
    </li>
  );
}

type HabitosDaMetaProps = {
  meta: Goal;
  /** Os atrelados que aparecem (sem os arquivados). */
  atrelados: Habit[];
  /** Todos os da pessoa, para a lista dos que dá para atrelar. */
  habitos: readonly Habit[];
  registros: readonly HabitLog[];
  hoje: DateKey;
  onAtrelar: (id: EntityId) => void;
  onCriar: () => void;
};

/** Os hábitos que empurram a meta e a lista para atrelar mais um. */
export function HabitosDaMeta({ meta, atrelados, habitos, registros, hoje, onAtrelar, onCriar }: HabitosDaMetaProps) {
  const [escolhendo, setEscolhendo] = useState(false);
  const lista = `escolher-${meta.id}`;

  return (
    <section aria-label="Hábitos atrelados" className="flex flex-col gap-3">
      <div className={CABECALHO_DA_SECAO}>
        <h3 className={TITULO}>Hábitos atrelados</h3>
        <span className={LEGENDA}>{atrelados.length}</span>
      </div>
      <div className={`${CARTAO} flex flex-col px-5 py-2`}>
        <ul>
          {atrelados.map((h) => (
            <Linha key={h.id} habito={h} semana={semanaDoHabito(h.id, registros, hoje)} />
          ))}
        </ul>
        <button
          type="button"
          aria-expanded={escolhendo}
          aria-controls={lista}
          onClick={() => setEscolhendo(!escolhendo)}
          className="mt-2 mb-3 min-h-11 w-full cursor-pointer rounded-sm border-[1.5px] border-dashed border-line p-3 font-extrabold text-muted hover:border-sapo hover:text-ink"
        >
          + Atrelar hábito
        </button>
        {escolhendo ? (
          <ul id={lista} aria-label="Hábitos sem meta" className="mb-3 flex flex-col gap-1.5 rounded-sm bg-line/40 p-2.5">
            {habitosSoltos(habitos).map((h) => (
              <li key={h.id} className={OPCAO}>
                <b>{h.title}</b>
                <span className={`ml-auto ${LEGENDA}`}>{textoDaFrequencia(h.weekdays)}</span>
                <button
                  type="button"
                  aria-label={`Atrelar ${h.title}`}
                  onClick={() => onAtrelar(h.id)}
                  className="min-h-11 cursor-pointer rounded-[10px] bg-sapo px-3 py-[5px] text-[13px] font-extrabold text-ink-sobre-acao shadow-[inset_0_-3px_0_var(--pulo-sapo-borda)]"
                >
                  Atrelar
                </button>
              </li>
            ))}
            <li>
              <button type="button" onClick={onCriar} className={`${OPCAO} min-h-11 w-full cursor-pointer text-left text-muted`}>
                + Criar hábito pra essa meta
              </button>
            </li>
          </ul>
        ) : null}
      </div>
    </section>
  );
}
