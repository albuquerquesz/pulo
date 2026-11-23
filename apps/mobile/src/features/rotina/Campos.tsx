import type { ComponentRef, ReactNode, Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { minTouchTarget, radius } from '@/theme/tokens';
import { useTheme } from '@/theme';
import { Texto } from '@/ui';

/** Opção de uma escolha (dia da semana, tipo do bloco). Alvo de toque de no mínimo 44 px. */
export function Escolha({
  rotulo,
  texto,
  selecionado,
  onPress,
  papel = 'radio',
  testID,
}: {
  /** Frase para leitor de tela (ex.: "Segunda-feira"). */
  rotulo: string;
  /** O que aparece (ex.: "Seg"). */
  texto: string;
  selecionado: boolean;
  onPress: () => void;
  papel?: 'radio' | 'checkbox';
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={papel}
      accessibilityLabel={rotulo}
      accessibilityState={papel === 'radio' ? { selected: selecionado } : { checked: selecionado }}
      testID={testID}
      style={[
        styles.escolha,
        {
          backgroundColor: selecionado ? t.cores.sapo : t.cores.surface,
          borderColor: selecionado ? t.cores.sapoBorda : t.cores.line,
          borderWidth: selecionado ? 2 : 1,
        },
      ]}
    >
      <Texto variante="corpo" cor={selecionado ? 'inkSobreAcao' : 'ink'} style={styles.centro}>
        {texto}
      </Texto>
    </Pressable>
  );
}

export function GrupoDeEscolhas({ rotulo, papel = 'radiogroup', children }: { rotulo: string; papel?: 'radiogroup' | 'group'; children: ReactNode }) {
  return (
    <View accessibilityRole={papel} accessibilityLabel={rotulo} style={styles.grupo}>
      {children}
    </View>
  );
}

export type CampoRef = ComponentRef<typeof TextInput>;

export interface CampoDeTextoProps extends Omit<TextInputProps, 'style' | 'ref'> {
  ref?: Ref<CampoRef>;
  rotulo: string;
  erro?: string | null;
  dica?: string;
}

/** Campo com rótulo visível, erro anunciado e a mesma aparência do onboarding. */
export function CampoDeTexto({ ref, rotulo, erro, dica, ...entrada }: CampoDeTextoProps) {
  const t = useTheme();
  return (
    <View style={styles.campo}>
      <Texto variante="subtitulo">{rotulo}</Texto>
      <TextInput
        ref={ref}
        accessibilityLabel={rotulo}
        accessibilityHint={dica}
        placeholderTextColor={t.cores.muted}
        {...entrada}
        style={[
          styles.input,
          { color: t.cores.ink, backgroundColor: t.cores.surface, borderColor: erro ? t.cores.foco : t.cores.line, fontFamily: t.fontesProntas ? t.fonte.regular : undefined },
        ]}
      />
      {erro ? (
        <Texto variante="legenda" accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: t.cores.ink }}>
          {erro}
        </Texto>
      ) : dica ? (
        <Texto variante="legenda" cor="muted">
          {dica}
        </Texto>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  escolha: { minHeight: minTouchTarget, minWidth: minTouchTarget, paddingHorizontal: 10, borderRadius: radius.sm, justifyContent: 'center' },
  centro: { textAlign: 'center' },
  grupo: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  campo: { gap: 6 },
  input: { minHeight: 48, borderWidth: 2, borderRadius: 16, paddingHorizontal: 14, fontSize: 16 },
});
