import { useEffect } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { depthBorder, motion, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Texto } from './Texto';

export type VarianteDeToast = 'sucesso' | 'aviso';

export interface ToastProps {
  mensagem: string;
  variante?: VarianteDeToast;
  /** Texto da ação (ex.: "Desfazer"). Sem ele, o toast não tem botão. */
  acao?: string;
  onAcao?: () => void;
  /** Controla a entrada e a saída. Padrão true. */
  visivel?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Aviso curto. Entra deslizando (ou só com fade, se reduzir movimento). Texto sempre `ink`. */
export function Toast({ mensagem, variante = 'sucesso', acao, onAcao, visivel = true, style, testID }: ToastProps) {
  const t = useTheme();
  const c = t.cores;
  const fundo = variante === 'sucesso' ? c.sapo : c.atencao;
  const borda = variante === 'sucesso' ? c.sapoBorda : c.focoBorda;
  const p = useSharedValue(visivel ? 1 : 0);

  useEffect(() => {
    if (t.reduzirMovimento) p.value = withTiming(visivel ? 1 : 0, { duration: motion.reducedFade });
    else p.value = visivel ? withSpring(1, motion.spring) : withTiming(0, { duration: motion.quick });
  }, [visivel, t.reduzirMovimento, p]);

  const anim = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, p.value)),
    transform: [{ translateY: t.reduzirMovimento ? 0 : (1 - p.value) * 24 }],
  }));

  return (
    <Animated.View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={acao ? `${mensagem}. ${acao} disponível` : mensagem}
      pointerEvents={visivel ? 'auto' : 'none'}
      style={[styles.base, { backgroundColor: fundo, borderColor: borda, borderBottomWidth: depthBorder }, anim, style]}
    >
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={11} fill={t.inkSobreAcao} fillOpacity={0.14} />
        {variante === 'sucesso' ? (
          <Path d="M6.5 12.5 L10.5 16 L17.5 8" stroke={t.inkSobreAcao} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ) : (
          <>
            <Path d="M12 6.5 L12 13" stroke={t.inkSobreAcao} strokeWidth={2.6} strokeLinecap="round" />
            <Circle cx={12} cy={17} r={1.6} fill={t.inkSobreAcao} />
          </>
        )}
      </Svg>
      <Texto variante="corpo" cor="inkSobreAcao" style={styles.texto}>
        {mensagem}
      </Texto>
      {acao && (
        <Pressable
          onPress={onAcao}
          accessibilityRole="button"
          accessibilityLabel={acao}
          hitSlop={4}
          style={[styles.acao, { backgroundColor: 'rgba(31,42,36,0.12)' }]}
        >
          <Texto variante="subtitulo" cor="inkSobreAcao">
            {acao}
          </Texto>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, borderWidth: 0, paddingLeft: 14, paddingRight: 8, paddingVertical: 8, minHeight: 56 },
  texto: { flex: 1 },
  acao: { minHeight: 44, minWidth: 44, borderRadius: radius.sm, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
});
