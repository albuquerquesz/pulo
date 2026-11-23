import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp } from '@/features/app';
import { autenticacaoDoApp } from '@/features/sessao/auth';
import { Texto, Toast } from '@/ui';
import { TemaProvider, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Um cliente de login por execução do app.
const autenticacao = autenticacaoDoApp();

export const COLUNA_MAX = 480;

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider autenticacao={autenticacao}>
        <TemaDoUsuario>
          <Raiz />
        </TemaDoUsuario>
      </AppProvider>
    </SafeAreaProvider>
  );
}

function TemaDoUsuario({ children }: { children: ReactNode }) {
  const { user } = useApp();
  return (
    <TemaProvider tema={user?.theme ?? 'sistema'} reduzirMovimento={user?.reduceMotion ?? false}>
      {children}
    </TemaProvider>
  );
}

function Raiz() {
  const t = useTheme();
  const { carregando, fase, user, demo, aviso, esconderAviso } = useApp();
  const dadosProntos = fase === 'pronto';
  const pronto = t.fontesProntas && !carregando;

  useEffect(() => {
    if (pronto) void SplashScreen.hideAsync().catch(() => undefined);
  }, [pronto]);

  // A abertura continua visível até a fonte e o repositório estarem prontos.
  if (!pronto) return null;

  return (
    <View style={[styles.fora, { backgroundColor: t.cores.bg }]}>
      <View style={[styles.coluna, { backgroundColor: t.cores.bg }]}>
        <StatusBar style={t.escuro ? 'light' : 'dark'} />
        {demo ? (
          <View style={[styles.selo, { backgroundColor: t.cores.sol }]} accessibilityRole="alert" testID="selo-demo">
            <Texto variante="legenda" cor="inkSobreAcao" accessibilityLabel="Modo demo, dados de exemplo">
              Modo demo, dados de exemplo
            </Texto>
          </View>
        ) : null}
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.cores.bg } }}>
          <Stack.Protected guard={fase === 'login' || fase === 'sem_conexao'}>
            <Stack.Screen name="login" />
          </Stack.Protected>
          <Stack.Protected guard={dadosProntos && !!user}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="rotina" />
          </Stack.Protected>
          <Stack.Protected guard={dadosProntos && !user}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>
          <Stack.Screen name="dev/galeria" />
        </Stack>
        {aviso ? (
          <View style={styles.aviso} pointerEvents="box-none">
            <Toast
              key={aviso.id}
              mensagem={aviso.mensagem}
              variante={aviso.variante === 'atencao' ? 'aviso' : 'sucesso'}
              acao={aviso.acao}
              onAcao={() => {
                aviso.onAcao?.();
                esconderAviso();
              }}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fora: { flex: 1, alignItems: 'center', ...(Platform.OS === 'web' ? { minHeight: '100vh' as unknown as number } : null) },
  coluna: { flex: 1, width: '100%', maxWidth: COLUNA_MAX },
  selo: { paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center', minHeight: 32, justifyContent: 'center' },
  aviso: { position: 'absolute', left: 16, right: 16, bottom: 104 },
});
