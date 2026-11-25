import { Fragment } from 'react';

import { HABITS } from '@pulo/core/config/decisions';
import type { HabitDayState, HabitStats } from '@pulo/core/domain/types';

import { linhasDoCalendario, NOME_DO_ESTADO } from './logic';

const PARCIAL = 'bg-[color-mix(in_srgb,var(--pulo-sapo)_45%,var(--pulo-line))]';
const SEM_REGISTRO = 'bg-line/75';

const CELULA: Record<HabitDayState, string> = {
  feito: 'bg-sapo',
  parcial: PARCIAL,
  descanso: 'bg-descanso/55',
  vazio: SEM_REGISTRO,
  fora: SEM_REGISTRO,
  futuro: 'border-[1.5px] border-dashed border-line',
};

const LEGENDA: readonly { nome: string; cor: string }[] = [
  { nome: NOME_DO_ESTADO.feito, cor: CELULA.feito },
  { nome: NOME_DO_ESTADO.parcial, cor: CELULA.parcial },
  { nome: NOME_DO_ESTADO.descanso, cor: CELULA.descanso },
  { nome: NOME_DO_ESTADO.vazio, cor: CELULA.vazio },
];

const dataCurta = (date: string) => date.split('-').reverse().slice(0, 2).join('/');

/** O calendário das últimas semanas (`.calor`): uma coluna por semana, uma linha por dia. */
export function Calendario({ calendario }: { calendario: HabitStats['calendario'] }) {
  return (
    <>
      <div
        role="img"
        aria-label={`Calendário das últimas ${HABITS.statsWeeks} semanas`}
        className="grid items-center gap-[3px] @min-[30rem]:gap-[5px]"
        style={{ gridTemplateColumns: `minmax(0, 28px) repeat(${calendario.length}, minmax(0, 1fr))` }}
      >
        {linhasDoCalendario(calendario).map((linha, i) => (
          <Fragment key={i}>
            <span className="text-xs font-extrabold text-muted">{linha.letra}</span>
            {linha.dias.map((d) => (
              <i
                key={d.date}
                title={`${dataCurta(d.date)}: ${NOME_DO_ESTADO[d.estado]}`}
                data-date={d.date}
                data-estado={d.estado}
                data-hoje={d.hoje || undefined}
                className={`aspect-square rounded-[5px] ${CELULA[d.estado]} ${d.hoje ? 'outline-2 outline-offset-1 outline-foco' : ''}`}
              />
            ))}
          </Fragment>
        ))}
      </div>
      <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {LEGENDA.map((item) => (
          <span key={item.nome} className="inline-flex items-center gap-1.5">
            <i className={`size-3 rounded-[3px] ${item.cor}`} />
            {item.nome}
          </span>
        ))}
      </div>
    </>
  );
}
