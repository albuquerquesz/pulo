import { lightColors } from '@/theme/tokens';

/** Geometria do sapo no viewBox 300x300, base em y = 270. Derivada dos geradores do conceito. */
export const VIEWBOX = 300;
export const BASE_Y = 270;

export const INK_DO_SAPO = '#2A1A12';

function mistura(c1: string, c2: string, t: number): string {
  const x = [1, 3, 5].map((j) =>
    Math.round(parseInt(c1.slice(j, j + 2), 16) * (1 - t) + parseInt(c2.slice(j, j + 2), 16) * t),
  );
  return '#' + x.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export const COR = {
  principal: lightColors.sapo,
  escura: lightColors.sapoBorda,
  barriga: '#EAFFC4',
  media: mistura(lightColors.sapo, lightColors.sapoBorda, 0.55),
  clara: mistura(lightColors.sapo, '#FFFFFF', 0.35),
  bochecha: '#FF9A9A',
  ink: INK_DO_SAPO,
  branco: '#FFFFFF',
  brilho: lightColors.sol,
  suor: '#8FD3FF',
  zzz: lightColors.descanso,
  impacto: '#C9A46C',
  girino: '#7FB856',
  girinoEscuro: '#639C3E',
} as const;

export const CORPO = { cx: 150, cy: 190, rx: 66, ry: 76 };
export const CABECA = { cx: 150, cy: 112, rx: 86, ry: 52 };
export const OLHO = { dx: 43, cy: 64, r: 27 };

/** Pivôs (x, y) das peças, no viewBox. Usados nas animações e na documentação das peças. */
export const PIVOTS = {
  sapo: [150, BASE_Y],
  cabeca: [150, 150],
  olhoEsquerdo: [150 - OLHO.dx, OLHO.cy],
  olhoDireito: [150 + OLHO.dx, OLHO.cy],
  palpebraEsquerda: [150 - OLHO.dx, OLHO.cy - OLHO.r],
  palpebraDireita: [150 + OLHO.dx, OLHO.cy - OLHO.r],
  boca: [150, 128],
  corpo: [150, BASE_Y],
  barriga: [150, 207],
  bracoEsquerdo: [98.5, 171],
  bracoDireito: [201.5, 171],
  maoEsquerda: [119.6, 239],
  maoDireita: [180.4, 239],
  coxaEsquerda: [86, 226],
  coxaDireita: [214, 226],
  peEsquerdo: [60.7, 264],
  peDireito: [239.3, 264],
  bochechaEsquerda: [83, 131],
  bochechaDireita: [217, 131],
  suor: [214, 102],
  balao: [256, 32],
  zzz: [248, 46],
  brilhos: [150, 60],
  impacto: [150, BASE_Y],
  girinoCauda: [180, 232],
} as const;

export type NomeDePeca = keyof typeof PIVOTS;

/** Escala do sapo jovem (fase 3) em relação ao adulto (fase 4), como no conceito. */
export const ESCALA_JOVEM = 0.66;
