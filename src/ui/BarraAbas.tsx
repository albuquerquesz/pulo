import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { minTouchTarget, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Texto } from './Texto';

export interface AbaDaBarra {
  chave: string;
  rotulo: string;
  /** Ícone próprio. Sem ele, usa o ícone padrão da chave (hoje, rotina, foco, progresso, perfil). */
  icone?: (p: { cor: string; tamanho: number }) => React.ReactNode;
}

export interface BarraAbasProps {
  abas: AbaDaBarra[];
  ativa: string;
  onSelecionar: (chave: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function IconePadrao({ chave, cor, tamanho }: { chave: string; cor: string; tamanho: number }) {
  const p = { stroke: cor, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
      {chave === 'hoje' ? (
        <>
          <Path d="M3 11 L12 4 L21 11" {...p} />
          <Path d="M6 10 L6 20 L18 20 L18 10" {...p} />
        </>
      ) : chave === 'rotina' ? (
        <>
          <Rect x={4} y={5} width={16} height={15} rx={3} {...p} />
          <Path d="M4 10 L20 10 M9 3 L9 7 M15 3 L15 7" {...p} />
        </>
      ) : chave === 'foco' ? (
        <>
          <Circle cx={12} cy={12} r={8} {...p} />
          <Path d="M12 7 L12 12 L15 14" {...p} />
        </>
      ) : chave === 'progresso' ? (
        <Path d="M4 19 L4 14 M10 19 L10 9 M16 19 L16 12 M21 19 L21 5" {...p} />
      ) : chave === 'perfil' ? (
        <>
          <Circle cx={12} cy={8.5} r={3.8} {...p} />
          <Path d="M4.5 20 C5.5 15.5 18.5 15.5 19.5 20" {...p} />
        </>
      ) : (
        <Circle cx={12} cy={12} r={6} {...p} />
      )}
    </Svg>
  );
}

/** Barra de abas. A ativa tem pílula de sapo e texto `ink`; a inativa usa `muted`. */
export function BarraAbas({ abas, ativa, onSelecionar, style, testID }: BarraAbasProps) {
  const t = useTheme();
  const c = t.cores;
  return (
    <View
      accessibilityRole="tablist"
      testID={testID}
      style={[styles.barra, { backgroundColor: c.surface, borderTopColor: c.line }, style]}
    >
      {abas.map((a) => {
        const sel = a.chave === ativa;
        // ink de ação sobre a pílula sapo (sempre escuro); muted nas inativas
        const cor = sel ? t.inkSobreAcao : c.muted;
        return (
          <Pressable
            key={a.chave}
            onPress={() => onSelecionar(a.chave)}
            accessibilityRole="tab"
            accessibilityLabel={a.rotulo}
            accessibilityState={{ selected: sel }}
            aria-selected={sel}
            style={styles.aba}
          >
            <View style={[styles.pilula, sel && { backgroundColor: c.sapo }]}>
              {a.icone ? a.icone({ cor, tamanho: 24 }) : <IconePadrao chave={a.chave} cor={cor} tamanho={24} />}
            </View>
            <Texto variante="legenda" style={{ color: sel ? c.ink : c.muted, fontWeight: sel ? '800' : '600' }}>
              {a.rotulo}
            </Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barra: { flexDirection: 'row', borderTopWidth: 2, paddingTop: 6, paddingBottom: 8, paddingHorizontal: 4 },
  aba: { flex: 1, minHeight: minTouchTarget + 12, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pilula: { width: 56, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
