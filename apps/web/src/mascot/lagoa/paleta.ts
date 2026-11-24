import type { Phase } from '@pulo/core/domain/types';
import { lightColors } from '@/theme/tokens';

export function mistura(c1: string, c2: string, t: number): string {
  const x = [1, 3, 5].map((j) =>
    Math.round(parseInt(c1.slice(j, j + 2), 16) * (1 - t) + parseInt(c2.slice(j, j + 2), 16) * t),
  );
  return '#' + x.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export interface PaletaDaLagoa {
  agua: string;
  margem: string;
  lama: string;
  folha: string;
  folhaSombra: string;
  junco: string;
  nuvem: string;
  noite: boolean;
}

const AGUA_DIA: Record<Phase, string> = { 1: '#8FD3C8', 2: '#4FD1B5', 3: lightColors.agua, 4: '#38B796' };
const AGUA_FUNDA = '#17305C';

/** Paleta do cenário. Sem céu desenhado: a cena fica sobre o fundo do app; a noite aparece na água mais funda e nas cores. */
export function paletaDaLagoa(fase: Phase, noite: boolean): PaletaDaLagoa {
  if (noite) {
    return {
      agua: mistura(AGUA_DIA[fase], AGUA_FUNDA, 0.55),
      margem: '#3F6B43',
      lama: '#5C4630',
      folha: '#3E9E5E',
      folhaSombra: '#2C6B3E',
      junco: '#3F6B2C',
      nuvem: '#5A6FA0',
      noite: true,
    };
  }
  return {
    agua: AGUA_DIA[fase],
    margem: '#7FB35A',
    lama: '#8A6A47',
    folha: '#5EC47A',
    folhaSombra: '#3A8E45',
    junco: '#5A8F3A',
    nuvem: '#FFFFFF',
    noite: false,
  };
}

export const GEOMETRIA_DA_AGUA: Record<Phase, { rx: number; ry: number; cy: number }> = {
  1: { rx: 110, ry: 38, cy: 238 },
  2: { rx: 124, ry: 46, cy: 234 },
  3: { rx: 136, ry: 54, cy: 230 },
  4: { rx: 140, ry: 56, cy: 230 },
};
