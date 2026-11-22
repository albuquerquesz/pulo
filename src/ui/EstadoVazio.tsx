import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { FrogMood, Phase } from '@/domain/types';
import { Sapo } from '@/mascot/sapo/Sapo';
import { spacing } from '@/theme/tokens';

import { Botao } from './Botao';
import { Texto } from './Texto';

export interface EstadoVazioProps {
  titulo: string;
  texto?: string;
  /** Texto do botão; sem ele não há botão. */
  acao?: string;
  onAcao?: () => void;
  fase?: Phase;
  estadoDoSapo?: FrogMood;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Tela vazia com o sapo, uma frase e um botão. */
export function EstadoVazio({ titulo, texto, acao, onAcao, fase = 1, estadoDoSapo = 'parado', style, testID }: EstadoVazioProps) {
  return (
    <View style={[styles.base, style]} testID={testID}>
      <Sapo fase={fase} estado={estadoDoSapo} tamanho={160} />
      <Texto variante="titulo" style={styles.centro} accessibilityRole="header">
        {titulo}
      </Texto>
      {texto ? (
        <Texto cor="muted" style={styles.centro}>
          {texto}
        </Texto>
      ) : null}
      {acao ? <Botao titulo={acao} onPress={onAcao} largura="auto" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  centro: { textAlign: 'center' },
});
