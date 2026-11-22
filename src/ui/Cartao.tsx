import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { depthBorder, pressDepth, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface CartaoProps {
  children: ReactNode;
  selecionado?: boolean;
  /** Com onPress o cartão vira botão e afunda ao toque. */
  onPress?: () => void;
  rotulo?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Cartao({ children, selecionado, onPress, rotulo, style, testID }: CartaoProps) {
  const t = useTheme();
  const c = t.cores;
  const borda = selecionado ? c.sapoBorda : c.line;
  const base = {
    backgroundColor: c.surface,
    borderColor: borda,
    borderWidth: selecionado ? 2 : 1,
  } as const;

  if (!onPress) {
    return (
      <View
        testID={testID}
        accessibilityLabel={rotulo}
        style={[styles.base, base, { borderBottomWidth: depthBorder }, style]}
      >
        {children}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ selected: !!selecionado }}
      aria-selected={!!selecionado}
      style={({ pressed }) => [
        styles.base,
        base,
        {
          borderBottomWidth: pressed ? depthBorder - pressDepth : depthBorder,
          transform: [{ translateY: pressed ? pressDepth : 0 }],
          marginBottom: pressed ? pressDepth : 0,
          minHeight: 44,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
});
