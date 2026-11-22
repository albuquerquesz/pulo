import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Texto } from './Texto';

export interface BalaoProps {
  texto: string;
  /** 1 ou 2 linhas (o resto vira reticências). Padrão 2. */
  linhas?: 1 | 2;
  /** Posição do rabinho. Padrão: embaixo à esquerda (aponta para o sapo). */
  rabo?: 'baixo' | 'cima' | 'nenhum';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Balão de fala do sapo. */
export function Balao({ texto, linhas = 2, rabo = 'baixo', style, testID }: BalaoProps) {
  const t = useTheme();
  const c = t.cores;
  return (
    <View style={[{ alignSelf: 'flex-start', maxWidth: 320 }, style]} testID={testID} accessible accessibilityRole="text" accessibilityLabel={`Sapo diz: ${texto}`}>
      {rabo === 'cima' && <Rabo cor={c.surface} borda={c.line} cima />}
      <View style={[styles.corpo, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Texto numberOfLines={linhas}>{texto}</Texto>
      </View>
      {rabo === 'baixo' && <Rabo cor={c.surface} borda={c.line} />}
    </View>
  );
}

function Rabo({ cor, borda, cima }: { cor: string; borda: string; cima?: boolean }) {
  return (
    <Svg width={22} height={12} viewBox="0 0 22 12" style={[styles.rabo, cima && { transform: [{ scaleY: -1 }], marginBottom: -2, marginTop: 0 }]}>
      <Path d="M0 0 L11 12 L22 0 Z" fill={cor} />
      <Path d="M0 0 L11 12 L22 0" stroke={borda} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  corpo: { borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  rabo: { marginLeft: 22, marginTop: -2 },
});
