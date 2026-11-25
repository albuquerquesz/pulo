import type { ReactNode } from 'react';

import { GOALS, HABITS } from '@pulo/core/config/decisions';
import type { HabitInput } from '@pulo/core/domain/habits';
import type { EntityId, Goal, GoalChest, Habit, HabitState, HabitStats } from '@pulo/core/domain/types';
import { Foguinho, FUNDO_DA_COR } from '@/ui';

import { CARTAO, TITULO } from '../hoje/estilos';
import { horaCheia } from '../hoje/logic';
import { Agenda } from './Agenda';
import { Calendario } from './Calendario';
import { BOTAO_FANTASMA, ETIQUETA, ICONE } from './estilos';
import { iconeDoHabito, PERIODOS, textoDaFrequencia, textoDaTaxa } from './logic';
import { MetaDoHabito } from './MetaDoHabito';

function Numero({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-extrabold tracking-[0.06em] text-muted uppercase">{rotulo}</dt>
      <dd className="flex items-center gap-[3px] text-[26px] leading-[1.1] font-extrabold tabular-nums">{children}</dd>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="flex flex-col gap-3">
      <h3 className={TITULO}>{titulo}</h3>
      {children}
    </section>
  );
}

export interface AcoesDoHabito {
  mudar: (mudanca: Partial<HabitInput>) => void;
  mudarEstado: (estado: HabitState) => void;
  arquivar: () => void;
  trocarMeta: (goalId: EntityId | null) => void;
  verMeta: (goalId: EntityId) => void;
  editar: () => void;
}

type DetalheDoHabitoProps = {
  habito: Habit;
  /** `null` enquanto não chegam. */
  stats: HabitStats | null;
  metas: readonly Goal[];
  baus: readonly GoalChest[];
  acoes: AcoesDoHabito;
};

/** O detalhe à direita: cabeçalho, números, calendário, meta, agenda e rodapé. */
export function DetalheDoHabito({ habito, stats, metas, baus, acoes }: DetalheDoHabitoProps) {
  const meta = metas.find((m) => m.id === habito.goalId);
  const periodo = PERIODOS.find((p) => p.chave === habito.period);
  const pausado = habito.state === 'pausado';
  return (
    <div className="flex flex-col gap-5">
      <div className={`${CARTAO} flex flex-wrap items-start gap-[18px] p-5 @min-[26rem]:p-6`}>
        <span aria-hidden="true" className={`${ICONE} size-16 rounded-[18px] text-[32px] ${FUNDO_DA_COR[habito.color ?? HABITS.defaultColor]}`}>
          {iconeDoHabito(habito)}
        </span>
        <div className="min-w-0 flex-1 basis-40">
          <h2 className="text-2xl leading-[1.15] font-extrabold">{habito.title}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`${ETIQUETA} bg-line/70`}>🔁 {textoDaFrequencia(habito.weekdays)}</span>
            {periodo ? (
              <span className={`${ETIQUETA} bg-line/70`}>
                {periodo.icone} {periodo.nome}
              </span>
            ) : null}
            {habito.reminderOn && habito.reminderMinutes !== undefined ? (
              <span className={`${ETIQUETA} bg-line/70`}>⏰ {horaCheia(habito.reminderMinutes)}</span>
            ) : null}
            {meta ? (
              <span className={`${ETIQUETA} bg-sapo/30`}>
                {meta.icon ?? GOALS.defaultIcon} {meta.title}
              </span>
            ) : null}
          </div>
        </div>
        <button type="button" onClick={acoes.editar} className={`${BOTAO_FANTASMA} ml-auto px-4 py-[9px]`}>
          Editar
        </button>
      </div>
      <dl className={`${CARTAO} grid grid-cols-2 gap-3 p-5 @min-[26rem]:grid-cols-4 @min-[26rem]:px-6 @min-[26rem]:py-[22px]`}>
        <Numero rotulo="Sequência">
          <Foguinho className="size-[26px]" />
          {stats?.sequencia ?? '…'}
        </Numero>
        <Numero rotulo="Recorde">{stats?.recorde ?? '…'}</Numero>
        <Numero rotulo="Conclusão">{stats ? textoDaTaxa(stats.taxa) : '…'}</Numero>
        <Numero rotulo="Vezes feito">{stats?.total ?? '…'}</Numero>
      </dl>
      <Secao titulo={`Últimas ${HABITS.statsWeeks} semanas`}>
        <div className={`${CARTAO} p-4 @min-[26rem]:p-5`}>
          {stats ? <Calendario calendario={stats.calendario} /> : <p className="text-muted">Carregando o calendário…</p>}
        </div>
      </Secao>
      <Secao titulo="Meta">
        <MetaDoHabito habito={habito} metas={metas} baus={baus} onTrocar={acoes.trocarMeta} onVerMeta={acoes.verMeta} />
      </Secao>
      <Secao titulo="Agenda">
        <Agenda habito={habito} onMudar={acoes.mudar} />
      </Secao>
      <div className="flex flex-wrap gap-2.5">
        <button type="button" onClick={() => acoes.mudarEstado(pausado ? 'ativo' : 'pausado')} className={`${BOTAO_FANTASMA} px-[22px] py-3`}>
          {pausado ? 'Retomar hábito' : 'Pausar hábito'}
        </button>
        <button type="button" onClick={acoes.arquivar} className={`${BOTAO_FANTASMA} px-[22px] py-3`}>
          Arquivar
        </button>
      </div>
    </div>
  );
}
