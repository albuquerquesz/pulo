import { StyleSheet, View } from 'react-native';

import { Sapo } from '@/mascot';
import { Botao, EstadoVazio, Texto } from '@/ui';

import { Tela, useApp } from '../app';

export const TEXTO_SEM_SINAL = 'A lagoa ficou sem sinal. Confira a internet e tente de novo.';

/** Porta do app: sem sessão e sem demo. Também mostra "sem sinal" quando há sessão mas o servidor não respondeu. */
export function LoginScreen() {
  const { fase, entrar, entrando, erroDeLogin, loginDisponivel, enableDemo, tentarDeNovo, sair } = useApp();

  if (fase === 'sem_conexao') {
    return (
      <Tela semBarra>
        <EstadoVazio titulo="Sem sinal por aqui" texto={TEXTO_SEM_SINAL} acao="Tentar de novo" onAcao={() => void tentarDeNovo()} />
        <Botao titulo="Entrar com outra conta" variante="fantasma" onPress={() => void sair()} />
        <Botao titulo="Ver o demo" variante="fantasma" onPress={() => void enableDemo()} />
      </Tela>
    );
  }

  return (
    <Tela semBarra>
      <View style={styles.centro}>
        <Sapo fase={1} estado="parado" tamanho={180} />
      </View>
      <Texto variante="display" accessibilityRole="header">
        Bem-vindo à lagoa
      </Texto>
      <Texto cor="muted">
        Entre para guardar sua rotina e seu progresso na sua conta, e continuar de onde parou em qualquer aparelho.
      </Texto>

      <Botao
        titulo="Entrar com Google"
        rotulo="Entrar com Google"
        onPress={() => void entrar()}
        carregando={entrando}
        desativado={!loginDisponivel}
        testID="entrar-google"
      />
      {erroDeLogin ? (
        <Texto cor="muted" accessibilityRole="alert" accessibilityLiveRegion="polite" testID="erro-de-login">
          {erroDeLogin}
        </Texto>
      ) : null}
      {!loginDisponivel ? (
        <Texto variante="legenda" cor="muted">
          O login ainda não está configurado neste app.
        </Texto>
      ) : null}

      <View style={styles.demo}>
        <Texto variante="legenda" cor="muted">
          Só quer espiar? O demo usa dados de exemplo, não pede conta e não guarda nada no servidor.
        </Texto>
        <Botao titulo="Ver o demo" variante="fantasma" onPress={() => void enableDemo()} testID="ver-demo" />
      </View>
    </Tela>
  );
}

const styles = StyleSheet.create({
  centro: { alignItems: 'center' },
  demo: { gap: 8, marginTop: 8 },
});
