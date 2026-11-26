import type { Weekday } from '@pulo/core/domain/types';

import { letraDoDia, nomeDoDia, SEMANA_DA_TELA } from './logic';

type DiasProps = { dias: readonly Weekday[]; onAlternar: (dia: Weekday) => void };

/** Os sete dias da frequência (`.dsem`). */
export function Dias({ dias, onAlternar }: DiasProps) {
  return (
    <div role="group" aria-label="Dias da semana" className="flex max-w-full gap-1 @min-[26rem]:gap-2">
      {SEMANA_DA_TELA.map((dia) => {
        const ligado = dias.includes(dia);
        return (
          <button
            key={dia}
            type="button"
            aria-pressed={ligado}
            aria-label={nomeDoDia(dia)}
            onClick={() => onAlternar(dia)}
            className={`grid size-9 min-w-0 shrink cursor-pointer place-items-center rounded-sm border-[1.5px] font-extrabold @min-[26rem]:size-10 ${
              ligado ? 'border-sapo-borda bg-sapo text-ink-sobre-acao shadow-[inset_0_-3px_0_var(--pulo-sapo-borda)]' : 'border-line text-muted'
            }`}
          >
            {letraDoDia(dia)}
          </button>
        );
      })}
    </div>
  );
}
