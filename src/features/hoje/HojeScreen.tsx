import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CHECKIN_LOW_ENERGY_COPY, CHECKIN_QUESTION } from '@/domain/checkin';
import { estadoDoSapo, Lagoa } from '@/mascot';
import { useTheme } from '@/theme';
import { Balao, Botao, Cartao, ChipEnergia, EstadoVazio, Texto } from '@/ui';
import type { Energy } from '@/domain/types';

import { agoraDaLagoa, blocoTexto, dentroDoDiaDoUsuario, Secao, Tela, useApp, useCarregar } from '../app';
import {
  alternarHabito,
  carregarHoje,
  comecarFoco,
  concluirDescansoDoBloco,
  diaDeDescanso,
  fraseDoSapo,
  registrarEnergia,
  type DadosHoje,
} from './logic';
import { criarPlanoInicial } from '@/domain/routine';

const ENERGIAS: Energy[] = [1, 2, 3, 4, 5];

export const TEXTO_DE_ERRO = 'A lagoa ficou sem sinal. Seus dados estão salvos aqui.';

export function HojeScreen() {
  const app = useApp();
  const { repo, clock, user, evento, emitirEvento, mostrarAviso, refresh } = app;
  const router = useRouter();
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [salto, setSalto] = useState(0);
  const aoMudarMarco = useCallback(
    (marco: boolean) => {
      if (!marco) return;
      emitirEvento('pouso');
      mostrarAviso({ mensagem: 'Seu sapo cresceu! Olha só a lagoa nova.' });
    },
    [emitirEvento, mostrarAviso],
  );

  const { estado, recarregar } = useCarregar(async () => {
    if (!user) throw new Error('sem usuário');
    const dados = await carregarHoje(repo, clock, user);
    // A fase guardada já é a nova: o marco só aparece uma vez.
    if (dados.marco) aoMudarMarco(true);
    return dados;
  });

  const lado = Math.min(width, 480) - 32;

  if (!user) return null;

  if (estado.tipo === 'carregando') {
    return (
      <Tela titulo="Hoje">
        <View accessibilityLabel="Carregando a lagoa" accessibilityRole="progressbar" style={styles.esqueleto}>
          <View style={[styles.bloco, { height: lado * 0.6, backgroundColor: t.cores.line }]} />
          <View style={[styles.bloco, { height: 48, backgroundColor: t.cores.line }]} />
          <View style={[styles.bloco, { height: 96, backgroundColor: t.cores.line }]} />
        </View>
      </Tela>
    );
  }

  if (estado.tipo === 'erro') {
    return (
      <Tela titulo="Hoje">
        <EstadoVazio titulo="Sem sinal por aqui" texto={TEXTO_DE_ERRO} acao="Tentar de novo" onAcao={() => void recarregar()} />
      </Tela>
    );
  }

  const d: DadosHoje = estado.dados;
  const dentroDoDia = dentroDoDiaDoUsuario(user, d.agora);
  const humor = estadoDoSapo({
    phase: d.mascote.phase,
    latestEnergyToday: d.energia,
    focusRunning: d.sessaoAtiva !== null,
    aiAnalyzing: false,
    activeEvent: evento,
    withinUserDay: dentroDoDia,
  });

  const montarPlano = async () => {
    await criarPlanoInicial(repo, clock.now());
    refresh();
  };

  if (!d.temRotina) {
    return (
      <Tela titulo="Hoje">
        <EstadoVazio
          titulo="Vamos montar seu dia?"
          texto="Eu preparo um plano de exemplo e você ajusta depois."
          acao="Criar plano de exemplo"
          onAcao={() => void montarPlano()}
          fase={d.mascote.phase}
        />
      </Tela>
    );
  }

  const comecar = async (bloco?: DadosHoje['blocos'][number]['bloco']) => {
    const r = await comecarFoco(repo, clock, user, bloco);
    if (!r.ok && r.error.code !== 'sessao_em_andamento') {
      mostrarAviso({ mensagem: r.error.message, variante: 'atencao' });
      return;
    }
    refresh();
    router.navigate('/foco');
  };

  const energia = async (nivel: Energy) => {
    await registrarEnergia(repo, clock, user, nivel);
    refresh();
  };

  const descansar = async () => {
    const r = await diaDeDescanso(repo, clock, user);
    emitirEvento('feliz');
    if (r.phaseChanged) aoMudarMarco(true);
    mostrarAviso({ mensagem: 'Dia de descanso registrado. A lagoa agradece.' });
    refresh();
  };

  const habito = async (id: string, feito: boolean) => {
    const marcou = await alternarHabito(repo, clock, user, id, feito);
    if (marcou) {
      setSalto((s) => s + 1);
      emitirEvento('feliz');
    }
    refresh();
  };

  const descansoDoBloco = async (id: string) => {
    const r = await concluirDescansoDoBloco(repo, clock, user, id);
    if (r) {
      emitirEvento('feliz');
      if (r.phaseChanged) aoMudarMarco(true);
    }
    refresh();
  };

  return (
    <Tela titulo="Hoje">
      <View style={styles.lagoa}>
        <Lagoa
          fase={d.mascote.phase}
          resumo={d.resumo}
          agora={agoraDaLagoa(user, d.agora, d.mascote.careDays, d.descansoHoje)}
          estadoDoSapo={humor}
          tamanho={lado}
          saltoDoSapo={salto}
        />
      </View>
      <Balao texto={fraseDoSapo(humor, d)} />

      <Secao titulo={CHECKIN_QUESTION}>
        <View style={styles.energias} accessibilityRole="radiogroup">
          {ENERGIAS.map((n) => (
            <ChipEnergia key={n} nivel={n} selecionado={d.energia === n} onPress={(v) => void energia(v)} />
          ))}
        </View>
        {d.energia !== null && d.energia <= 2 ? (
          <Cartao>
            <View style={styles.coluna}>
              <Texto>{CHECKIN_LOW_ENERGY_COPY}</Texto>
              <Botao titulo="Quero um dia de descanso" variante="agua" onPress={() => void descansar()} desativado={d.descansoHoje} />
            </View>
          </Cartao>
        ) : null}
      </Secao>

      <Botao
        titulo={d.sessaoAtiva ? 'Voltar ao foco' : 'Começar foco'}
        variante="foco"
        onPress={() => void comecar()}
        rotulo={d.sessaoAtiva ? 'Voltar ao foco em andamento' : 'Começar foco de 25 minutos'}
        testID="comecar-foco"
      />

      <Secao titulo="Blocos de hoje">
        {d.blocos.length === 0 ? (
          <Texto cor="muted">Nenhum bloco hoje. Que tal aproveitar para descansar?</Texto>
        ) : (
          d.blocos.map(({ bloco, feito }) => (
            <Cartao key={bloco.id} style={styles.linha}>
              <View style={styles.linhaTexto}>
                <Texto variante="subtitulo">{bloco.title ?? (bloco.kind === 'foco' ? 'Foco' : 'Descanso')}</Texto>
                <Texto cor="muted" variante="legenda">
                  {blocoTexto(bloco.startMinutes, bloco.durationMinutes)}
                  {feito ? ', feito' : ''}
                </Texto>
              </View>
              {feito ? null : bloco.kind === 'foco' ? (
                <Botao
                  titulo="Focar"
                  variante="fantasma"
                  largura="auto"
                  rotulo={`Começar foco do bloco das ${blocoTexto(bloco.startMinutes, bloco.durationMinutes)}`}
                  onPress={() => void comecar(bloco)}
                />
              ) : (
                <Botao titulo="Feito" variante="agua" largura="auto" rotulo="Marcar descanso como feito" onPress={() => void descansoDoBloco(bloco.id)} />
              )}
            </Cartao>
          ))
        )}
      </Secao>

      <Secao titulo="Hábitos">
        {d.habitos.length === 0 ? (
          <Texto cor="muted">Nenhum hábito para hoje.</Texto>
        ) : (
          d.habitos.map(({ habito: h, feito }) => (
            <Pressable
              key={h.id}
              onPress={() => void habito(h.id, feito)}
              accessibilityRole="checkbox"
              accessibilityLabel={h.title}
              accessibilityState={{ checked: feito }}
              style={[styles.habito, { backgroundColor: t.cores.surface, borderColor: feito ? t.cores.sapoBorda : t.cores.line }]}
            >
              <View style={[styles.caixa, { backgroundColor: feito ? t.cores.sapo : 'transparent', borderColor: feito ? t.cores.sapoBorda : t.cores.muted }]}>
                {feito ? <Texto variante="legenda" cor="inkSobreAcao">✓</Texto> : null}
              </View>
              <Texto style={feito ? styles.riscado : undefined}>{h.title}</Texto>
            </Pressable>
          ))
        )}
      </Secao>

      <Botao
        titulo={d.descansoHoje ? 'Hoje é dia de descanso' : 'Dia de descanso'}
        variante="fantasma"
        desativado={d.descansoHoje}
        rotulo="Marcar hoje como dia de descanso"
        onPress={() => void descansar()}
      />
    </Tela>
  );
}

const styles = StyleSheet.create({
  esqueleto: { gap: 12 },
  bloco: { borderRadius: 20, opacity: 0.6 },
  lagoa: { alignItems: 'center' },
  energias: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  coluna: { gap: 8 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  linhaTexto: { flex: 1 },
  habito: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12 },
  caixa: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  riscado: { textDecorationLine: 'line-through', opacity: 0.7 },
});
