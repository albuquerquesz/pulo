import type { Period } from '@pulo/core/domain/types';

import { PERIODOS } from './logic';

type PeriodoProps = { periodo: Period | undefined; onEscolher: (periodo: Period) => void };

/** O seletor de período (`.seg`). */
export function Periodo({ periodo, onEscolher }: PeriodoProps) {
  return (
    <div role="group" aria-label="Período" className="inline-flex rounded-sm bg-line/55 p-[3px]">
      {PERIODOS.map((p) => (
        <button
          key={p.chave}
          type="button"
          aria-pressed={p.chave === periodo}
          onClick={() => onEscolher(p.chave)}
          className={`min-h-9 cursor-pointer rounded-[9px] px-3 py-[5px] text-[13px] ${p.chave === periodo ? 'bg-surface font-extrabold shadow-[0_1px_3px_rgba(0,0,0,0.15)]' : ''}`}
        >
          {p.nome}
        </button>
      ))}
    </div>
  );
}
