import type { EntityId, Habit } from '@pulo/core/domain/types';

import { CARTAO } from '../hoje/estilos';
import { BOTAO_FANTASMA } from './estilos';
import { iconeDoHabito } from './logic';

type ArquivadosProps = { habitos: readonly Habit[]; onRestaurar: (id: EntityId) => void };

/** Os hábitos arquivados, recolhidos no pé da tela. */
export function Arquivados({ habitos, onRestaurar }: ArquivadosProps) {
  if (habitos.length === 0) return null;
  return (
    <details>
      <summary className="min-h-11 cursor-pointer py-2.5 text-[13px] font-extrabold tracking-[0.06em] text-muted uppercase">
        Arquivados ({habitos.length})
      </summary>
      <ul aria-label="Hábitos arquivados" className={`${CARTAO} flex max-w-xl flex-col divide-y divide-line px-4`}>
        {habitos.map((h) => (
          <li key={h.id} className="flex items-center gap-3 py-3">
            <span aria-hidden="true">{iconeDoHabito(h)}</span>
            <b className="min-w-0 flex-1 break-words">{h.title}</b>
            <button type="button" aria-label={`Restaurar ${h.title}`} onClick={() => onRestaurar(h.id)} className={`${BOTAO_FANTASMA} min-h-11 shrink-0 px-3.5 py-2 text-[13px]`}>
              Restaurar
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
