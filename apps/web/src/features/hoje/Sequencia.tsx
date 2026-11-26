import type { ReactNode } from 'react';

import { Foguinho } from '@/ui';

import { Floco } from '../casca/Floco';

import { CARTAO, TITULO } from './estilos';
import type { BarraDaSemana, DescansoDeHoje, TomDoDia } from './logic';

const COR_DA_LETRA: Record<TomDoDia, string> = {
  feito: 'text-[color-mix(in_srgb,var(--pulo-sol)_75%,var(--pulo-ink))]',
  descanso: 'text-descanso',
  gelo: 'text-agua',
  hoje: 'text-foco',
  apagado: 'text-muted',
};

/** O desenho sob a letra: fogo no feito, lua no descanso e floco no gelo. */
const ICONE_DO_TOM: Record<TomDoDia, ReactNode> = {
  feito: <Foguinho className="size-4" />,
  descanso: '☾',
  gelo: <Floco className="size-4" />,
  hoje: null,
  apagado: null,
};

type SequenciaProps = {
  dias: number;
  barra: BarraDaSemana;
  descanso: DescansoDeHoje;
  /** Esperando a resposta. */
  gravando: boolean;
  onDescanso: () => void;
};

/** A sequência com o foguinho e a barra da semana, que enche até hoje. */
export function Sequencia({ dias, barra, descanso, gravando, onDescanso }: SequenciaProps) {
  return (
    <section
      aria-label="Sequência"
      className={`${CARTAO} relative overflow-hidden bg-[linear-gradient(160deg,color-mix(in_srgb,var(--pulo-foco)_18%,var(--pulo-surface)),var(--pulo-surface)_70%)] p-5`}
    >
      <h2 className={TITULO}>Sequência</h2>
      <div className="mt-3.5 grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] sm:gap-7">
        <div className="flex items-center gap-4">
          <Foguinho className="size-16 origin-[50%_90%] animate-tremula drop-shadow-[0_6px_14px_color-mix(in_srgb,var(--pulo-foco)_45%,transparent)]" />
          <p className="text-[44px] leading-none font-extrabold">
            {dias}
            <small className="ml-1 text-base font-bold text-muted">{dias === 1 ? 'dia' : 'dias'}</small>
          </p>
        </div>
        <div className="mt-1 flex flex-col gap-[9px] rounded-md bg-bg/70 px-[18px] pt-3 pb-3.5">
          <ol aria-label="Dias da semana" className="grid grid-cols-7 pr-[42px] text-center text-[15px] font-extrabold">
            {barra.letras.map((dia) => (
              <li key={dia.date} data-tom={dia.tom} className={COR_DA_LETRA[dia.tom]}>
                <span aria-hidden="true" className="block">
                  {dia.letra}
                </span>
                <span aria-hidden="true" className="grid h-4 place-items-center text-sm leading-none">
                  {ICONE_DO_TOM[dia.tom]}
                </span>
                <span className="sr-only">{dia.descricao}</span>
              </li>
            ))}
          </ol>
          <div className="relative mr-[42px] h-5 rounded-full bg-[color-mix(in_srgb,var(--pulo-descanso)_35%,var(--pulo-line))]">
            <div
              data-testid="barra-cheia"
              className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-sol to-sol-quente shadow-[inset_0_5px_0_rgba(255,255,255,0.35)]"
              style={{ width: `${barra.cheio * 100}%` }}
            >
              <i className="absolute top-1/2 -right-[5px] size-[22px] -translate-y-1/2 animate-brilha rounded-full bg-[radial-gradient(circle,#fff_0_18%,rgba(255,255,255,0.55)_35%,transparent_70%)]" />
            </div>
            <span
              role="img"
              aria-label={barra.completa ? 'Semana completa' : 'Semana ainda por fechar'}
              className="absolute top-1/2 -right-[42px] block size-11 -translate-y-[55%]"
            >
              <Foguinho
                className={`size-11 ${barra.completa ? 'drop-shadow-[0_2px_0_rgba(0,0,0,0.25)]' : 'opacity-80 [filter:grayscale(1)_brightness(0.75)_drop-shadow(0_2px_0_rgba(0,0,0,0.25))]'}`}
              />
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <button
          type="button"
          disabled={gravando}
          onClick={onDescanso}
          className={`min-h-11 cursor-pointer rounded-md px-5 py-2.5 font-extrabold enabled:active:translate-y-[3px] disabled:cursor-wait ${
            descanso.marcado
              ? 'border-[1.5px] border-descanso text-ink shadow-[inset_0_-3px_0_var(--pulo-descanso)]'
              : 'bg-descanso text-on-descanso shadow-[inset_0_-4px_0_var(--pulo-descanso-borda)]'
          }`}
        >
          <span aria-hidden="true">☾ </span>
          {descanso.marcado ? 'Desmarcar descanso de hoje' : 'Descansar hoje'}
        </button>
      </div>
    </section>
  );
}
