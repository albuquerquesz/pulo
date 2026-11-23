import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { AgoraDaLagoa } from '@pulo/core/domain/lagoa';
import type { FrogMood, Phase } from '@pulo/core/domain/types';
import { Lagoa } from '@/mascot/lagoa/Lagoa';
import { Sapo } from '@/mascot/sapo/Sapo';
import { TemaProvider, useTheme } from '@/theme/useTheme';
import { spacing } from '@/theme/tokens';

import { AnelTimer } from './AnelTimer';
import { Balao } from './Balao';
import { BarraAbas } from './BarraAbas';
import { Botao } from './Botao';
import { Cartao } from './Cartao';
import { EstadoVazio } from './EstadoVazio';
import { Texto } from './Texto';
import { Toast } from './Toast';

const ESTADOS: FrogMood[] = ['parado', 'feliz', 'cansado', 'pensando', 'surpreso', 'focado', 'dormindo', 'pouso'];
const ABAS = [
  { chave: 'hoje', rotulo: 'Hoje' },
  { chave: 'rotina', rotulo: 'Rotina' },
  { chave: 'foco', rotulo: 'Foco' },
  { chave: 'progresso', rotulo: 'Lagoa' },
  { chave: 'perfil', rotulo: 'Perfil' },
];

const dia = (d: number, o: Partial<AgoraDaLagoa> = {}): AgoraDaLagoa => ({ diasDeCuidadoTotal: d, dentroDoDia: true, descansoHoje: false, ...o });

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={styles.secao}>
      <Texto variante="subtitulo">{titulo}</Texto>
      <View style={styles.linha}>{children}</View>
    </View>
  );
}

function Painel({ tema }: { tema: 'claro' | 'escuro' }) {
  const t = useTheme();
  const [aba, setAba] = useState('hoje');
  const [salto, setSalto] = useState(0);
  const [estado, setEstado] = useState<FrogMood>('parado');
  return (
    <View style={[styles.painel, { backgroundColor: t.cores.bg }]} testID={`galeria-${tema}`}>
      <Texto variante="titulo">{tema === 'claro' ? 'Dia na lagoa' : 'Noite na lagoa'}</Texto>

      <Secao titulo="Botao">
        <Botao titulo="Primário" onPress={() => setSalto((n) => n + 1)} />
        <Botao titulo="Foco" variante="foco" />
        <Botao titulo="Água" variante="agua" />
        <Botao titulo="Fantasma" variante="fantasma" />
        <Botao titulo="Desativado" desativado />
        <Botao titulo="Carregando" carregando variante="agua" />
      </Secao>

      <Secao titulo="Cartao">
        <Cartao><Texto>Cartão normal</Texto></Cartao>
        <Cartao selecionado><Texto>Cartão selecionado</Texto></Cartao>
        <Cartao onPress={() => undefined} rotulo="Cartão interativo"><Texto>Cartão interativo</Texto></Cartao>
      </Secao>

      <Secao titulo="AnelTimer: parado, rodando, pausa, concluído">
        <AnelTimer remainingMs={25 * 60000} totalMs={25 * 60000} estado="parado" tamanho={140} />
        <AnelTimer remainingMs={14 * 60000 + 20000} totalMs={25 * 60000} estado="rodando" tamanho={140} />
        <AnelTimer remainingMs={9 * 60000} totalMs={25 * 60000} estado="pausa" tamanho={140} />
        <AnelTimer remainingMs={0} totalMs={25 * 60000} estado="concluido" tamanho={140} />
      </Secao>

      <Secao titulo="Balao">
        <Balao texto="Bom te ver!" linhas={1} />
        <Balao texto="Hoje seus focos renderam menos à tarde, então que tal um foco curto de manhã?" linhas={2} />
      </Secao>

      <Secao titulo="Toast">
        <Toast mensagem="Hábito marcado" />
        <Toast mensagem="Esse bloco já passou" variante="aviso" />
        <Toast mensagem="Bloco movido" acao="Desfazer" />
      </Secao>

      <Secao titulo="EstadoVazio">
        <EstadoVazio titulo="Nada por aqui ainda" texto="Crie o primeiro hábito e o sapo vai gostar." acao="Criar hábito" />
      </Secao>

      <Secao titulo="BarraAbas">
        <View style={styles.cheia}><BarraAbas abas={ABAS} ativa={aba} onSelecionar={setAba} /></View>
      </Secao>

      <Secao titulo="Sapo: estados (fase 4, toque no botão primário para pular)">
        {ESTADOS.map((e) => (
          <View key={e} style={styles.celula}>
            <Sapo fase={4} estado={e} tamanho={110} salto={salto} />
            <Texto variante="legenda" cor="muted">{e}</Texto>
          </View>
        ))}
      </Secao>

      <Secao titulo="Sapo: fases 1 a 4">
        {([1, 2, 3, 4] as Phase[]).map((f) => (
          <View key={f} style={styles.celula}>
            <Sapo fase={f} estado={estado} tamanho={110} salto={salto} />
            <Texto variante="legenda" cor="muted">fase {f}</Texto>
          </View>
        ))}
        <View style={styles.chips}>
          {ESTADOS.map((e) => (
            <Botao key={e} titulo={e} variante={e === estado ? 'primario' : 'fantasma'} largura="auto" onPress={() => setEstado(e)} />
          ))}
        </View>
      </Secao>

      <Secao titulo="Lagoa: fases 1 a 4, noite, descanso, semana estável">
        {([1, 2, 3, 4] as Phase[]).map((f) => (
          <Lagoa key={f} fase={f} tamanho={220} resumo={{ careDays: 3, stable: false }} agora={dia([0, 3, 9, 16][f - 1])} />
        ))}
        <Lagoa fase={3} tamanho={220} resumo={{ careDays: 4, stable: false }} agora={dia(9, { dentroDoDia: false })} estadoDoSapo="dormindo" />
        <Lagoa fase={3} tamanho={220} resumo={{ careDays: 2, stable: false }} agora={dia(9, { descansoHoje: true })} />
        <Lagoa fase={4} tamanho={220} resumo={{ careDays: 6, stable: true }} agora={dia(16)} estadoDoSapo="feliz" />
      </Secao>
    </View>
  );
}

/** Todos os componentes em todos os estados, claro e escuro. Rota de desenvolvimento (monte numa tela). */
export function Galeria() {
  const [reduzir, setReduzir] = useState(false);
  return (
    <ScrollView testID="galeria" contentContainerStyle={styles.raiz}>
      <TemaProvider carregarFontes={false} tema="claro" reduzirMovimento={reduzir}>
        <View style={{ padding: spacing.lg }}>
          <Botao titulo={reduzir ? 'Reduzir movimento: ligado' : 'Reduzir movimento: desligado'} variante="fantasma" onPress={() => setReduzir((v) => !v)} />
        </View>
        <Painel tema="claro" />
      </TemaProvider>
      <TemaProvider carregarFontes={false} tema="escuro" reduzirMovimento={reduzir}>
        <Painel tema="escuro" />
      </TemaProvider>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  raiz: { paddingBottom: 48 },
  painel: { padding: spacing.lg, gap: spacing.xl },
  secao: { gap: spacing.sm },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cheia: { alignSelf: 'stretch', flexGrow: 1, minWidth: 300 },
  celula: { alignItems: 'center' },
});
