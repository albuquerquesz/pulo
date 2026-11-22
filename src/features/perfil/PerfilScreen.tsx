import { StyleSheet, Switch, View } from 'react-native';

import type { User } from '@/domain/types';
import { useTheme } from '@/theme';
import { Botao, Cartao, Texto } from '@/ui';

import { confirmar, Secao, Tela, useApp } from '../app';
import { EscolhaDeHora } from './HorarioDoDia';

const TEMAS: { chave: User['theme']; rotulo: string }[] = [
  { chave: 'claro', rotulo: 'Claro' },
  { chave: 'escuro', rotulo: 'Escuro' },
  { chave: 'sistema', rotulo: 'Sistema' },
];

export function PerfilScreen() {
  const app = useApp();
  const { user, atualizarPerfil, apagarDados, demo, demoClock, enableDemo, disableDemo, refresh } = app;
  const t = useTheme();
  if (!user) return null;

  const inicio = Math.round(user.dayStartMinutes / 60);
  const fim = Math.round(user.dayEndMinutes / 60);

  const apagar = async () => {
    const ok = await confirmar(
      'Apagar todos os meus dados?',
      'Isso remove seu sapo, sua rotina e seu progresso deste aparelho. Não dá para desfazer.',
      'Apagar tudo',
      'Cancelar',
    );
    if (ok) await apagarDados();
  };

  return (
    <Tela titulo="Perfil">
      <Texto cor="muted">Seu sapo se chama {user.frogName}.</Texto>

      <Secao titulo="Seu dia">
        <EscolhaDeHora rotulo="Começa às" horas={inicio} min={0} max={Math.min(22, fim - 1)} onChange={(h) => void atualizarPerfil({ dayStartMinutes: h * 60 })} />
        <EscolhaDeHora rotulo="Termina às" horas={fim} min={inicio + 1} max={24} onChange={(h) => void atualizarPerfil({ dayEndMinutes: h * 60 })} />
      </Secao>

      <Secao titulo="Aparência">
        <View style={styles.linha} accessibilityRole="radiogroup">
          {TEMAS.map((o) => (
            <Cartao
              key={o.chave}
              selecionado={user.theme === o.chave}
              onPress={() => void atualizarPerfil({ theme: o.chave })}
              rotulo={`Tema ${o.rotulo.toLowerCase()}`}
              style={styles.tema}
            >
              <Texto style={styles.centro}>{o.rotulo}</Texto>
            </Cartao>
          ))}
        </View>
        <View style={styles.linhaSwitch}>
          <Texto style={styles.expande}>Reduzir movimento</Texto>
          <Switch
            value={user.reduceMotion}
            onValueChange={(v) => void atualizarPerfil({ reduceMotion: v })}
            accessibilityLabel="Reduzir movimento"
            trackColor={{ false: t.cores.line, true: t.cores.agua }}
          />
        </View>
      </Secao>

      <Secao titulo="Modo demo">
        {demo && demoClock ? (
          <Cartao testID="painel-demo">
            <View style={styles.coluna}>
              <Texto>Modo demo, dados de exemplo. Nada aqui é seu de verdade.</Texto>
              <Botao titulo="Avançar 1 dia" variante="agua" onPress={() => { demoClock.advanceDays(1); refresh(); }} />
              <Botao titulo="Avançar 1 semana" variante="agua" onPress={() => { demoClock.advanceWeeks(1); refresh(); }} />
              <Botao titulo="Reiniciar o demo" variante="fantasma" onPress={() => void enableDemo()} />
              <Botao titulo="Desligar modo demo" variante="fantasma" onPress={() => void disableDemo()} />
              <Texto variante="legenda" cor="muted">
                Hoje no demo: {demoClock.today()}
              </Texto>
            </View>
          </Cartao>
        ) : (
          <Cartao onPress={() => void enableDemo()} rotulo="Ligar modo demo, com dados de exemplo">
            <Texto>Ligar modo demo</Texto>
            <Texto variante="legenda" cor="muted">
              Carrega quatro semanas de dados de exemplo, sem mexer nos seus.
            </Texto>
          </Cartao>
        )}
      </Secao>

      <Secao titulo="Seus dados">
        <Botao titulo="Apagar todos os meus dados" variante="fantasma" onPress={() => void apagar()} />
      </Secao>
    </Tela>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', gap: 8 },
  tema: { flex: 1, minHeight: 48, justifyContent: 'center' },
  centro: { textAlign: 'center' },
  linhaSwitch: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  expande: { flex: 1 },
  coluna: { gap: 8 },
});
