import { ACCENT_COLORS } from '@pulo/core/config/decisions';
import type { AccentColor } from '@pulo/core/domain/types';

const COR: Record<AccentColor, string> = {
  sapo: 'bg-sapo',
  agua: 'bg-agua',
  foco: 'bg-foco',
  descanso: 'bg-descanso',
  sol: 'bg-sol',
  atencao: 'bg-atencao',
};

const NOME_DA_COR: Record<AccentColor, string> = {
  sapo: 'sapo',
  agua: 'água',
  foco: 'foco',
  descanso: 'descanso',
  sol: 'sol',
  atencao: 'atenção',
};

export type SeletorDeCorProps = { cor: AccentColor; onEscolher: (cor: AccentColor) => void };

/** As bolinhas de cor dos formulários de hábito e de meta. */
export function SeletorDeCor({ cor, onEscolher }: SeletorDeCorProps) {
  return (
    <div role="group" aria-label="Cor" className="flex flex-wrap gap-2">
      {ACCENT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Cor ${NOME_DA_COR[c]}`}
          aria-pressed={c === cor}
          onClick={() => onEscolher(c)}
          className={`size-11 cursor-pointer rounded-full border-contorno ${COR[c]} ${c === cor ? 'border-4' : 'border-2'}`}
        />
      ))}
    </div>
  );
}
