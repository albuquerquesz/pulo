import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { depthBorder, minTouchTarget, pressDepth, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Texto } from './Texto';

export type VarianteDeBotao = 'primario' | 'foco' | 'agua' | 'fantasma';

export interface BotaoProps {
  titulo: string;
  onPress?: () => void;
  variante?: VarianteDeBotao;
  desativado?: boolean;
  carregando?: boolean;
  /** Rótulo de acessibilidade; padrão: o título. */
  rotulo?: string;
  largura?: 'cheia' | 'auto';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Botão com borda inferior de 4 px; pressionado, afunda 3 px. Texto sempre `ink` sobre as cores de ação. */
export function Botao({ titulo, onPress, variante = 'primario', desativado, carregando, rotulo, largura = 'cheia', style, testID }: BotaoProps) {
  const t = useTheme();
  const c = t.cores;
  const mapa = {
    primario: { fundo: c.sapo, borda: c.sapoBorda, texto: t.inkSobreAcao },
    foco: { fundo: c.foco, borda: c.focoBorda, texto: t.inkSobreAcao },
    agua: { fundo: c.agua, borda: c.aguaBorda, texto: t.inkSobreAcao },
    fantasma: { fundo: 'transparent', borda: c.line, texto: c.ink },
  }[variante];
  const bloqueado = !!desativado || !!carregando;

  return (
    <Pressable
      onPress={bloqueado ? undefined : onPress}
      disabled={bloqueado}
      accessibilityRole="button"
      accessibilityLabel={rotulo ?? titulo}
      accessibilityState={{ disabled: !!desativado, busy: !!carregando }}
      aria-busy={!!carregando}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        largura === 'auto' && styles.auto,
        {
          backgroundColor: mapa.fundo,
          borderColor: mapa.borda,
          borderBottomWidth: pressed && !bloqueado ? depthBorder - pressDepth : depthBorder,
          transform: [{ translateY: pressed && !bloqueado ? pressDepth : 0 }],
          marginBottom: pressed && !bloqueado ? pressDepth : 0,
          opacity: desativado ? 0.45 : 1,
        },
        variante === 'fantasma' && { borderWidth: 2, borderBottomWidth: pressed && !bloqueado ? 2 : depthBorder },
        style,
      ]}
    >
      <View style={styles.conteudo}>
        {carregando && <ActivityIndicator size="small" color={mapa.texto} />}
        <Texto variante="subtitulo" style={{ color: mapa.texto, textAlign: 'center' }} numberOfLines={1}>
          {titulo}
        </Texto>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouchTarget + 8,
    minWidth: minTouchTarget,
    borderRadius: radius.md,
    borderWidth: 0,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  auto: { alignSelf: 'flex-start' },
  conteudo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
