import type { ElementType, HTMLAttributes } from 'react';

import type { ColorName } from '@/theme/tokens';

export type VarianteDeTexto = 'display' | 'titulo' | 'subtitulo' | 'corpo' | 'legenda';
export type CorDeTexto = ColorName | 'inkSobreAcao';

export type TextoProps = HTMLAttributes<HTMLElement> & {
  variante?: VarianteDeTexto;
  /** Token de cor, ou 'inkSobreAcao' para texto sobre sapo, agua, foco, sol e atencao. */
  cor?: CorDeTexto;
  /** Números do timer em tabular. */
  tabular?: boolean;
  /** Elemento HTML (padrão `p`; títulos usam h1, h2...). */
  como?: ElementType;
  /** Corta em N linhas com reticências. */
  linhas?: 1 | 2;
};

const VARIANTE: Record<VarianteDeTexto, string> = {
  display: 'texto-display',
  titulo: 'texto-titulo',
  subtitulo: 'texto-subtitulo',
  corpo: 'texto-corpo',
  legenda: 'texto-legenda',
};

const COR: Record<CorDeTexto, string> = {
  bg: 'text-bg',
  surface: 'text-surface',
  line: 'text-line',
  ink: 'text-ink',
  muted: 'text-muted',
  sapo: 'text-sapo',
  sapoBorda: 'text-sapo-borda',
  agua: 'text-agua',
  aguaBorda: 'text-agua-borda',
  foco: 'text-foco',
  focoBorda: 'text-foco-borda',
  descanso: 'text-descanso',
  descansoBorda: 'text-descanso-borda',
  sol: 'text-sol',
  atencao: 'text-atencao',
  onDescanso: 'text-on-descanso',
  inkSobreAcao: 'text-ink-sobre-acao',
};

const LINHAS = { 1: 'line-clamp-1', 2: 'line-clamp-2' };

/** Texto do app, com a tipografia da spec 02. */
export function Texto({ variante = 'corpo', cor = 'ink', tabular, como: Tag = 'p', linhas, className = '', ...resto }: TextoProps) {
  const classes = [VARIANTE[variante], COR[cor], tabular ? 'tabular-nums' : '', linhas ? LINHAS[linhas] : '', 'm-0', className];
  return <Tag {...resto} className={classes.filter(Boolean).join(' ')} />;
}
