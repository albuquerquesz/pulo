import type { Energy } from '@pulo/core/domain/types';

import { Texto } from './Texto';

export const ROTULO_DE_ENERGIA: Record<Energy, string> = {
  1: 'muito baixa',
  2: 'baixa',
  3: 'média',
  4: 'boa',
  5: 'muito boa',
};

const NIVEIS: Energy[] = [1, 2, 3, 4, 5];

export type ChipEnergiaProps = {
  nivel: Energy;
  selecionado?: boolean;
  onPress?: (nivel: Energy) => void;
  testID?: string;
};

type IconeDeEnergiaProps = {
  nivel: Energy;
  /** Classes de preenchimento das barras cheias e vazias (ex.: `fill-agua`). */
  cheia: string;
  vazia: string;
  tamanho?: number;
};

/** Ícone de 5 barras, com `nivel` barras cheias. */
export function IconeDeEnergia({ nivel, cheia, vazia, tamanho = 28 }: IconeDeEnergiaProps) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 28 28" aria-hidden>
      {NIVEIS.map((i) => (
        <rect key={i} x={2 + (i - 1) * 5} y={26 - (6 + i * 4)} width={4} height={6 + i * 4} rx={2} className={i <= nivel ? cheia : vazia} />
      ))}
    </svg>
  );
}

/** Chip de energia de 1 a 5. */
export function ChipEnergia({ nivel, selecionado, onPress, testID }: ChipEnergiaProps) {
  return (
    <button
      type="button"
      onClick={() => onPress?.(nivel)}
      aria-label={`Energia ${nivel} de 5, ${ROTULO_DE_ENERGIA[nivel]}`}
      aria-pressed={!!selecionado}
      data-testid={testID}
      className={[
        'flex min-h-16 min-w-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border-2 border-b-4 px-2',
        'transition-transform duration-75 active:translate-y-[3px] active:border-b',
        selecionado ? 'border-sapo-borda bg-sapo' : 'border-line bg-surface',
      ].join(' ')}
    >
      <IconeDeEnergia nivel={nivel} cheia={selecionado ? 'fill-ink-sobre-acao' : 'fill-agua'} vazia={selecionado ? 'fill-ink-sobre-acao/25' : 'fill-line'} />
      <Texto como="span" variante="legenda" cor={selecionado ? 'inkSobreAcao' : 'ink'}>
        {nivel}
      </Texto>
    </button>
  );
}
