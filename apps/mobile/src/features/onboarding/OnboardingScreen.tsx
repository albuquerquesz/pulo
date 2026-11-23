import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ONBOARDING_PADRAO, Tela, useApp } from '../app';
import { Sapo } from '@/mascot';
import { useTheme } from '@/theme';
import { Botao, Texto } from '@/ui';

import { EscolhaDeHora } from '../perfil/HorarioDoDia';

export function OnboardingScreen() {
  const { concluirOnboarding } = useApp();
  const router = useRouter();
  const t = useTheme();
  const [nome, setNome] = useState(ONBOARDING_PADRAO.frogName);
  const [inicio, setInicio] = useState(ONBOARDING_PADRAO.startHour);
  const [fim, setFim] = useState(ONBOARDING_PADRAO.endHour);
  const [salvando, setSalvando] = useState(false);

  const comecar = async () => {
    setSalvando(true);
    try {
      await concluirOnboarding({ frogName: nome, startHour: inicio, endHour: fim });
      router.replace('/');
    } catch {
      // O aviso de erro já foi mostrado pelo repositório; a pessoa pode tentar de novo.
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Tela semBarra>
      <View style={styles.centro}>
        <Sapo fase={1} estado="feliz" tamanho={180} />
      </View>
      <Texto variante="display" accessibilityRole="header">
        Oi, eu sou o Pulo
      </Texto>
      <Texto cor="muted">Vamos cuidar da sua lagoa juntos, no seu ritmo. Só três coisas antes de começar.</Texto>

      <View style={styles.campo}>
        <Texto variante="subtitulo">Como vai se chamar seu sapo?</Texto>
        <TextInput
          value={nome}
          onChangeText={setNome}
          placeholder="Pulo"
          placeholderTextColor={t.cores.muted}
          maxLength={24}
          accessibilityLabel="Nome do sapo"
          style={[
            styles.input,
            { color: t.cores.ink, backgroundColor: t.cores.surface, borderColor: t.cores.line, fontFamily: t.fontesProntas ? t.fonte.regular : undefined },
          ]}
          testID="nome-do-sapo"
        />
      </View>

      <View style={styles.campo}>
        <Texto variante="subtitulo">Seu dia</Texto>
        <EscolhaDeHora rotulo="O dia começa às" horas={inicio} min={0} max={Math.min(22, fim - 1)} onChange={setInicio} />
        <EscolhaDeHora rotulo="O dia termina às" horas={fim} min={inicio + 1} max={24} onChange={setFim} />
      </View>

      <Botao titulo="Começar" carregando={salvando} onPress={() => void comecar()} testID="comecar" />
    </Tela>
  );
}

const styles = StyleSheet.create({
  centro: { alignItems: 'center' },
  campo: { gap: 8 },
  input: { minHeight: 48, borderWidth: 2, borderRadius: 16, paddingHorizontal: 14, fontSize: 16 },
});
