import { GOALS, HABITS } from '@pulo/core/config/decisions';
import type { EntityId } from '@pulo/core/domain/types';
import { Foguinho, FUNDO_DA_COR } from '@/ui';

import { CARTAO } from '../hoje/estilos';
import { ICONE } from './estilos';
import { agruparPorPeriodo, iconeDoHabito, textoDaFrequencia, type DadosDosHabitos, type EstatisticasPorHabito } from './logic';

type ListaDeHabitosProps = {
  dados: DadosDosHabitos;
  /** `null` enquanto as estatísticas não chegam. */
  estatisticas: EstatisticasPorHabito | null;
  selecionado: EntityId | null;
  onSelecionar: (id: EntityId) => void;
};

/** Os hábitos por período (`.hb-lista`). */
export function ListaDeHabitos({ dados, estatisticas, selecionado, onSelecionar }: ListaDeHabitosProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {agruparPorPeriodo(dados.habitos).map((grupo) => (
        <section key={grupo.chave} aria-label={grupo.titulo} className="flex flex-col gap-2.5">
          <h2 className="mx-1 mt-2.5 mb-0.5 text-[13px] font-extrabold tracking-[0.06em] text-muted uppercase">{grupo.titulo}</h2>
          {grupo.habitos.map((h) => {
            const meta = dados.metas.find((m) => m.id === h.goalId);
            const feito = dados.feitosHoje.has(h.id);
            const sequencia = estatisticas?.get(h.id)?.sequencia;
            const aberto = h.id === selecionado;
            return (
              <button
                key={h.id}
                type="button"
                aria-current={aberto ? 'true' : undefined}
                onClick={() => onSelecionar(h.id)}
                className={`${CARTAO} grid w-full cursor-pointer grid-cols-[44px_minmax(0,1fr)_auto_auto] items-center gap-3.5 px-4 py-3.5 text-left ${
                  aberto
                    ? '@min-[36rem]/pagina:border-sapo @min-[36rem]/pagina:shadow-[0_0_0_2px_color-mix(in_srgb,var(--pulo-sapo)_35%,transparent)]'
                    : 'hover:border-sapo/50'
                }`}
              >
                <span aria-hidden="true" className={`${ICONE} size-11 rounded-[13px] text-[22px] ${FUNDO_DA_COR[h.color ?? HABITS.defaultColor]}`}>
                  {iconeDoHabito(h)}
                </span>
                <span className="min-w-0 overflow-hidden">
                  <b className="block break-words">{h.title}</b>
                  <span className="flex min-w-0 items-center gap-2 text-[13px] text-muted">
                    <span className="flex-none whitespace-nowrap">{textoDaFrequencia(h.weekdays)}</span>
                    {meta ? (
                      <span className="min-w-0 truncate rounded-full bg-line/70 px-2 py-px text-xs">
                        {meta.icon ?? GOALS.defaultIcon} {meta.title}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span title="sequência" className="inline-flex items-center gap-[3px] font-extrabold tabular-nums">
                  <Foguinho className="size-[18px]" />
                  <span className="sr-only">sequência: </span>
                  {sequencia ?? '…'}
                </span>
                <span
                  role="img"
                  aria-label={feito ? 'feito hoje' : 'não feito hoje'}
                  className={`grid size-[30px] place-items-center rounded-full border-[2.5px] ${feito ? 'border-sapo-borda bg-sapo text-ink-sobre-acao' : 'border-muted'}`}
                >
                  {feito ? '✓' : null}
                </span>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
