import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import { BarraAbas } from '@/ui';

const ABAS = [
  { rota: 'index', chave: 'hoje', rotulo: 'Hoje' },
  { rota: 'foco', chave: 'foco', rotulo: 'Foco' },
  { rota: 'semana', chave: 'rotina', rotulo: 'Semana' },
  { rota: 'perfil', chave: 'perfil', rotulo: 'Perfil' },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigateToTab }) => (
        <BarraAbas
          style={styles.barra}
          abas={ABAS.map((a) => ({ chave: a.chave, rotulo: a.rotulo }))}
          ativa={ABAS.find((a) => a.rota === state.routes[state.index]?.name)?.chave ?? 'hoje'}
          onSelecionar={(chave) => {
            const aba = ABAS.find((a) => a.chave === chave);
            const rota = aba && state.routes.find((r) => r.name === aba.rota);
            if (rota) navigateToTab(rota.key);
          }}
        />
      )}
    >
      <Tabs.Screen name="index" options={{ title: 'Hoje' }} />
      <Tabs.Screen name="foco" options={{ title: 'Foco' }} />
      <Tabs.Screen name="semana" options={{ title: 'Semana' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barra: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
