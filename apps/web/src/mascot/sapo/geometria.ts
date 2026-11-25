import { lightColors } from '@/theme/tokens';

import { cor, mistura as misturaDeTokens } from '../cores';
import type { Corpo } from '../machine';

/** Geometria do sapo no viewBox 300x300, base em y = 270. Derivada dos geradores do conceito. */
export const VIEWBOX = 300;
export const BASE_Y = 270;

export const INK_DO_SAPO = '#2A1A12';

function misturaHex(c1: string, c2: string, t: number): string {
  const x = [1, 3, 5].map((j) =>
    Math.round(parseInt(c1.slice(j, j + 2), 16) * (1 - t) + parseInt(c2.slice(j, j + 2), 16) * t),
  );
  return '#' + x.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Cores das peças da spec 32: sempre tokens de styles.css. */
export const TOKEN = {
  agua: cor('agua'),
  aguaBorda: cor('agua-borda'),
  listra: misturaDeTokens('agua', 35, 'creme'),
  folha: cor('sapo-borda'),
  folhaMurcha: misturaDeTokens('sapo-borda', 45, 'madeira'),
  talo: cor('madeira-escura'),
  sol: cor('sol'),
  solQuente: cor('sol-quente'),
  foco: cor('foco'),
  descanso: cor('descanso'),
  rosa: cor('etiqueta-rosa'),
  azul: cor('etiqueta-azul'),
  madeira: cor('madeira'),
  madeiraClara: cor('madeira-clara'),
  madeiraEscura: cor('madeira-escura'),
  metal: cor('etiqueta-cinza'),
  contorno: cor('contorno'),
} as const;

export const COR = {
  principal: lightColors.sapo,
  escura: lightColors.sapoBorda,
  barriga: '#EAFFC4',
  media: misturaHex(lightColors.sapo, lightColors.sapoBorda, 0.55),
  clara: misturaHex(lightColors.sapo, '#FFFFFF', 0.35),
  bochecha: '#FF9A9A',
  ink: INK_DO_SAPO,
  branco: '#FFFFFF',
  brilho: lightColors.sol,
  suor: '#8FD3FF',
  zzz: lightColors.descanso,
  impacto: '#C9A46C',
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
} as const;

export type NomeDePeca = keyof typeof PIVOTS;

/** Escala do sapo jovem (fases 1 a 3) em relação ao adulto (fase 4). */
export const ESCALA_JOVEM = 0.66;

export type Ponto = readonly [number, number];

export interface BracoNaPose {
  /** Ponto de controle da curva do ombro até a mão. */
  cotovelo: Ponto;
  mao: Ponto;
}

export interface Bracos {
  esquerdo: BracoNaPose;
  direito: BracoNaPose;
}

export const OMBRO = { esquerdo: [100, 168], direito: [200, 168] } as const satisfies Record<keyof Bracos, Ponto>;

/** O braço parado ao longo do corpo, reaproveitado pelas poses que mexem só um lado. */
const SOLTO: Bracos = {
  esquerdo: { cotovelo: [80, 208], mao: [112, 242] },
  direito: { cotovelo: [220, 208], mao: [188, 242] },
};

/** Braços de cada pose fora do `sentado`, que usa as peças originais. */
export const BRACOS_DA_POSE: Record<Exclude<Corpo, 'sentado'>, Bracos> = {
  caido: { esquerdo: { cotovelo: [66, 192], mao: [74, 248] }, direito: { cotovelo: [234, 192], mao: [226, 248] } },
  'maos-juntas': { esquerdo: { cotovelo: [70, 224], mao: [136, 196] }, direito: { cotovelo: [230, 224], mao: [164, 196] } },
  antena: { esquerdo: SOLTO.esquerdo, direito: { cotovelo: [232, 226], mao: [240, 190] } },
  cocando: { esquerdo: SOLTO.esquerdo, direito: { cotovelo: [290, 156], mao: [226, 76] } },
  'bracos-para-cima': { esquerdo: { cotovelo: [34, 176], mao: [38, 96] }, direito: { cotovelo: [266, 176], mao: [262, 96] } },
  peito: { esquerdo: { cotovelo: [34, 188], mao: [96, 218] }, direito: { cotovelo: [266, 188], mao: [204, 218] } },
  acenando: { esquerdo: SOLTO.esquerdo, direito: { cotovelo: [274, 182], mao: [264, 100] } },
  encolhido: { esquerdo: { cotovelo: [76, 236], mao: [170, 214] }, direito: { cotovelo: [224, 236], mao: [130, 224] } },
  martelando: { esquerdo: SOLTO.esquerdo, direito: { cotovelo: [268, 198], mao: [250, 164] } },
};
