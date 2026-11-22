import {
  darkColors,
  fontFamily,
  lightColors,
  motion,
  radius,
  spacing,
  typography,
  type ColorTokens,
} from './tokens';

export type PreferenciaDeTema = 'claro' | 'escuro' | 'sistema';
export type Esquema = 'claro' | 'escuro';

/** Esquema final a partir do sistema e da preferência do Perfil. */
export function resolverEsquema(
  sistema: 'light' | 'dark' | 'unspecified' | null | undefined,
  preferencia: PreferenciaDeTema = 'sistema',
): Esquema {
  if (preferencia === 'claro') return 'claro';
  if (preferencia === 'escuro') return 'escuro';
  return sistema === 'dark' ? 'escuro' : 'claro';
}

/** Reduzir movimento vale se o sistema OU o Perfil pedirem. */
export function resolverReduzirMovimento(sistema: boolean, perfil: boolean): boolean {
  return sistema || perfil;
}

export interface MovimentoResolvido {
  instant: number;
  quick: number;
  base: number;
  slow: number;
  /** Loops ambientes (respirar, piscar, ondas) permitidos. */
  loops: boolean;
  /** Pulos e squash permitidos. */
  saltos: boolean;
  /** Troca de estado do sapo: duração do desvanecimento. */
  fadeDeEstado: number;
  spring: { damping: number; stiffness: number };
  ambientMin: number;
  ambientMax: number;
  landingSquash: { x: number; y: number; durationMs: number };
}

/** Constantes de movimento já resolvidas. Reduzido: durações 0, sem loops e sem saltos; só o fade de 120 ms. */
export function resolverMovimento(reduzir: boolean): MovimentoResolvido {
  if (reduzir) {
    return {
      instant: 0,
      quick: 0,
      base: 0,
      slow: 0,
      loops: false,
      saltos: false,
      fadeDeEstado: motion.reducedFade,
      spring: motion.spring,
      ambientMin: motion.ambientMin,
      ambientMax: motion.ambientMax,
      landingSquash: { x: 1, y: 1, durationMs: 0 },
    };
  }
  return {
    instant: motion.instant,
    quick: motion.quick,
    base: motion.base,
    slow: motion.slow,
    loops: true,
    saltos: true,
    fadeDeEstado: motion.instant,
    spring: motion.spring,
    ambientMin: motion.ambientMin,
    ambientMax: motion.ambientMax,
    landingSquash: motion.landingSquash,
  };
}

export interface Tema {
  esquema: Esquema;
  escuro: boolean;
  cores: ColorTokens;
  /** Texto sobre sapo, agua, foco, sol e atencao: sempre o ink escuro. */
  inkSobreAcao: string;
  tipografia: typeof typography;
  fonte: typeof fontFamily;
  /** Nunito carregada. Antes disso, cai na fonte do sistema. */
  fontesProntas: boolean;
  espacamento: typeof spacing;
  raio: typeof radius;
  reduzirMovimento: boolean;
  movimento: MovimentoResolvido;
}

export function montarTema(esquema: Esquema, reduzirMovimento: boolean, fontesProntas: boolean): Tema {
  return {
    esquema,
    escuro: esquema === 'escuro',
    cores: esquema === 'escuro' ? darkColors : lightColors,
    inkSobreAcao: lightColors.ink,
    tipografia: typography,
    fonte: fontFamily,
    fontesProntas,
    espacamento: spacing,
    raio: radius,
    reduzirMovimento,
    movimento: resolverMovimento(reduzirMovimento),
  };
}
