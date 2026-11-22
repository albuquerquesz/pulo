import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import type { Energy } from '@/domain/types';
import { depthBorder, pressDepth, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Texto } from './Texto';

export const ROTULO_DE_ENERGIA: Record<Energy, string> = {
  1: 'muito baixa',
  2: 'baixa',
  3: 'média',
  4: 'boa',
  5: 'muito boa',
};

export interface ChipEnergiaProps {
  nivel: Energy;
  selecionado?: boolean;
  onPress?: (nivel: Energy) => void;
  testID?: string;
}

/** Ícone de 5 barras, com `nivel` barras cheias. */
export function IconeDeEnergia({ nivel, cor, vazio, tamanho = 28 }: { nivel: Energy; cor: string; vazio: string; tamanho?: number }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 28 28">
      {[1, 2, 3, 4, 5].map((i) => (
        <Rect key={i} x={2 + (i - 1) * 5} y={26 - (6 + i * 4)} width={4} height={6 + i * 4} rx={2} fill={i <= nivel ? cor : vazio} />
      ))}
    </Svg>
  );
}

/** Chip de energia de 1 a 5. */
export function ChipEnergia({ nivel, selecionado, onPress, testID }: ChipEnergiaProps) {
  const t = useTheme();
  const c = t.cores;
  const fundoSel = c.sapo;
  return (
    <Pressable
      onPress={() => onPress?.(nivel)}
      accessibilityRole="button"
      accessibilityLabel={`Energia ${nivel} de 5, ${ROTULO_DE_ENERGIA[nivel]}`}
      accessibilityState={{ selected: !!selecionado }}
      aria-selected={!!selecionado}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: selecionado ? fundoSel : c.surface,
          borderColor: selecionado ? c.sapoBorda : c.line,
          borderBottomWidth: pressed ? depthBorder - pressDepth : depthBorder,
          transform: [{ translateY: pressed ? pressDepth : 0 }],
          marginBottom: pressed ? pressDepth : 0,
        },
      ]}
    >
      <View style={styles.centro}>
        <IconeDeEnergia
          nivel={nivel}
          cor={selecionado ? t.inkSobreAcao : c.agua}
          vazio={selecionado ? 'rgba(31,42,36,0.25)' : c.line}
        />
        <Texto variante="legenda" style={{ color: selecionado ? t.inkSobreAcao : c.ink }}>
          {nivel}
        </Texto>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: 56,
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  centro: { alignItems: 'center', gap: 2 },
});
