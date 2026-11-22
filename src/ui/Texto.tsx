import { Text, type TextProps, type TextStyle } from 'react-native';

import type { ColorName } from '@/theme/tokens';
import { typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export type VarianteDeTexto = keyof typeof typography;

export interface TextoProps extends TextProps {
  variante?: VarianteDeTexto;
  /** Token de cor, ou 'inkSobreAcao' para texto sobre sapo, agua, foco, sol e atencao. */
  cor?: ColorName | 'inkSobreAcao';
  /** Números do timer em tabular. */
  tabular?: boolean;
}

/** Texto do app: Nunito quando carregada, fonte do sistema antes disso. */
export function Texto({ variante = 'corpo', cor = 'ink', tabular, style, ...resto }: TextoProps) {
  const t = useTheme();
  const base = t.tipografia[variante];
  const peso = base.fontWeight;
  const familia = peso === '800' ? t.fonte.heavy : peso === '700' ? t.fonte.bold : t.fonte.regular;
  const estilo: TextStyle = {
    fontSize: base.fontSize,
    lineHeight: base.lineHeight,
    color: cor === 'inkSobreAcao' ? t.inkSobreAcao : t.cores[cor],
    ...(t.fontesProntas ? { fontFamily: familia } : { fontWeight: peso }),
    ...(tabular ? { fontVariant: ['tabular-nums'] } : null),
  };
  return <Text {...resto} style={[estilo, style]} />;
}
