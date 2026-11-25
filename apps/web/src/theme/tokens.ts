/**
 * Tokens da spec 02. Só o responsável pelo contrato altera este arquivo.
 * Regra de texto: texto sobre sapo, agua, foco, sol e atencao é sempre `ink`.
 * Branco só sobre `descanso`. Branco sobre `foco` tem contraste 2,57 e é proibido.
 */

export interface ColorTokens {
  bg: string;
  surface: string;
  line: string;
  ink: string;
  muted: string;
  sapo: string;
  sapoBorda: string;
  agua: string;
  aguaBorda: string;
  foco: string;
  focoBorda: string;
  descanso: string;
  descansoBorda: string;
  sol: string;
  atencao: string;
  /** Texto sobre descanso (única cor de ação com texto branco). */
  onDescanso: string;
}

const acao = {
  sapo: '#8FE05A',
  sapoBorda: '#6CC23F',
  agua: '#3FC9A2',
  aguaBorda: '#2EA888',
  foco: '#FF7A59',
  focoBorda: '#D9583A',
  descanso: '#6C63B5',
  descansoBorda: '#54499A',
  sol: '#FFD166',
  atencao: '#FFB020',
  onDescanso: '#FFFFFF',
} as const;

/** "Dia na lagoa". */
export const lightColors: ColorTokens = {
  bg: '#F7F3E3',
  surface: '#FFFFFF',
  line: '#E4E0CC',
  ink: '#1F2A24',
  muted: '#5E6B62',
  ...acao,
};

/** "Noite na lagoa". As cores de ação mantêm o valor. */
export const darkColors: ColorTokens = {
  bg: '#14201A',
  surface: '#1D2E25',
  line: '#2A3F33',
  ink: '#EAFFF0',
  muted: '#9DB3A5',
  ...acao,
};

/** Cores próprias do rascunho (spec 21): contorno grosso, joia, madeira e números do trilho. Iguais nos dois temas. */
export const drawingColors = {
  contorno: '#3B2A2F',
  joiaClara: '#EBDDFF',
  joia: '#B583FF',
  joiaEscura: '#7B3FE4',
  creme: '#FFF3DA',
  madeira: '#C98B5E',
  madeiraClara: '#E7B07E',
  folha: '#FBF4EE',
  sombraBranca: '#E4DCCB',
  lima: '#C7E36B',
  limaClara: '#E6F6A8',
  ceu: '#CBF1F6',
  cancelar: '#F08A7A',
  cancelarBorda: '#D0644F',
  numeroFoco: '#FF9B7A',
  numeroJoia: '#C29BFF',
  /** Ponta quente da barra da sequência. */
  solQuente: '#FFB347',
  /** Caixa do timer e mostradores (spec 23). */
  timerVerde: '#6FCB55',
  timerVerdeBorda: '#4FA83C',
  timerOuro: '#E9B85A',
  timerTrilho: '#2F5E2A',
  madeiraEscura: '#A86F43',
  /** Escolhido e botões da loja do quarto. */
  limaForte: '#D3E36B',
  bege: '#EFEACB',
  begeBorda: '#D9D2A8',
  /** Parte da casa já construída, na Ilha (spec 24). */
  prontaFundo: '#E9F8D9',
  prontaBorda: '#C6E6A6',
  prontaTexto: '#3F8F23',
} as const;

/** Céu noturno da lagoa (spec 04). */
export const nightSky = '#243A6B';

export const fontFamily = {
  regular: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  heavy: 'Nunito_800ExtraBold',
} as const;

/** tamanho / altura de linha / peso. */
export const typography = {
  display: { fontSize: 32, lineHeight: 36, fontWeight: '800' },
  titulo: { fontSize: 24, lineHeight: 28, fontWeight: '800' },
  subtitulo: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  corpo: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  legenda: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 12, md: 20, lg: 28, pill: 999 } as const;

/** Sem sombras: profundidade por borda inferior desta espessura, na cor escura do elemento. */
export const depthBorder = 4;
/** Botão pressionado desce este tanto, em px. */
export const pressDepth = 3;
export const minTouchTarget = 44;

/** Durações em ms. Com reduzir movimento, loops somem e trocas viram fade. */
export const motion = {
  instant: 90,
  quick: 160,
  base: 240,
  slow: 420,
  /** Loops ambientes: 3 a 6 s. */
  ambientMin: 3000,
  ambientMax: 6000,
  /** Troca de estado do sapo com reduzir movimento. */
  reducedFade: 120,
  spring: { damping: 12, stiffness: 180 },
  /** Squash do pouso: escala x por y em 120 ms. */
  landingSquash: { x: 1.22, y: 0.78, durationMs: 120 },
} as const;

export type ColorName = keyof ColorTokens;
