import { darkColors, drawingColors, lightColors, type ColorTokens } from './tokens';

/** Texto sobre cores de ação (sapo, agua, foco, sol, atencao) é sempre o `ink` do tema claro, nos dois temas. */
export const inkSobreAcao = lightColors.ink;

export const CONTRASTE_MINIMO = 4.5;
export const CONTRASTE_MINIMO_GRANDE = 3;

function canal(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Luminância relativa (WCAG 2.x) de uma cor `#RRGGBB`. */
export function luminancia(hex: string): number {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Razão de contraste WCAG entre duas cores, de 1 a 21. */
export function razaoDeContraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  const [claro, escuro] = la >= lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (escuro + 0.05);
}

export interface ParTexto {
  nome: string;
  texto: string;
  fundo: string;
  /** Texto grande (a partir de 24px, ou 18px em negrito): mínimo 3. */
  grande?: boolean;
}

export function minimoDoPar(par: ParTexto): number {
  return par.grande ? CONTRASTE_MINIMO_GRANDE : CONTRASTE_MINIMO;
}

export function passaContraste(par: ParTexto): boolean {
  return razaoDeContraste(par.texto, par.fundo) >= minimoDoPar(par);
}

/** Todas as combinações de texto sobre fundo que o app permite, por tema. */
export function paresPermitidos(cores: ColorTokens): ParTexto[] {
  const acao: (keyof ColorTokens)[] = ['sapo', 'agua', 'foco', 'sol', 'atencao'];
  return [
    { nome: 'ink sobre bg', texto: cores.ink, fundo: cores.bg },
    { nome: 'ink sobre surface', texto: cores.ink, fundo: cores.surface },
    { nome: 'muted sobre bg', texto: cores.muted, fundo: cores.bg },
    { nome: 'muted sobre surface', texto: cores.muted, fundo: cores.surface },
    ...acao.map((c) => ({ nome: `ink de ação sobre ${c}`, texto: inkSobreAcao, fundo: cores[c] })),
    { nome: 'onDescanso sobre descanso', texto: cores.onDescanso, fundo: cores.descanso },
  ];
}

/** Texto das peças do rascunho (placa, botões de contorno grosso, barra de valor): sempre o contorno sobre um fundo claro. */
export function paresDoRascunho(): ParTexto[] {
  const fundos = ['creme', 'folha', 'lima', 'limaClara', 'ceu', 'madeiraClara', 'cancelar'] as const;
  return [
    { nome: 'contorno sobre branco', texto: drawingColors.contorno, fundo: lightColors.surface },
    ...fundos.map((f) => ({ nome: `contorno sobre ${f}`, texto: drawingColors.contorno, fundo: drawingColors[f] })),
  ];
}

export const TEMAS_PARA_CONTRASTE = { claro: lightColors, escuro: darkColors } as const;
