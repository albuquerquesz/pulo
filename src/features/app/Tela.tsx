import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Texto } from '@/ui';
import { useTheme } from '@/theme';

/** Altura reservada para a barra de abas. */
export const ALTURA_DA_BARRA = 88;

/** Moldura de cada aba: fundo do tema, rolagem e margens. */
export function Tela({ titulo, children, semBarra }: { titulo?: string; children: ReactNode; semBarra?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.cores.bg }}
      contentContainerStyle={[
        styles.conteudo,
        { paddingTop: insets.top + t.espacamento.lg, paddingBottom: semBarra ? t.espacamento.xl : ALTURA_DA_BARRA + t.espacamento.xl },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {titulo ? (
        <Texto variante="titulo" accessibilityRole="header">
          {titulo}
        </Texto>
      ) : null}
      {children}
    </ScrollView>
  );
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={styles.secao}>
      <Texto variante="subtitulo" accessibilityRole="header">
        {titulo}
      </Texto>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingHorizontal: 16, gap: 16 },
  secao: { gap: 8 },
});
