import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { GETTING_TO_KNOW_TEXT, proposalLabel } from '@pulo/core/domain/ia';
import type { BlockSlot, Period, WeeklyProposal } from '@pulo/core/domain/types';
import { estadoDoSapo, Lagoa } from '@/mascot';
import { useTheme } from '@/theme';
import { Botao, Cartao, EstadoVazio, Texto } from '@/ui';

import { agoraDaLagoa, dentroDoDiaDoUsuario, Secao, slotTexto, Tela, useApp, useCarregar } from '../app';
import { mensagemDeErro } from '@pulo/client';

import type { DecisaoFeita } from './fonte';
import { carregarSemana, JANELA_DE_DESFAZER_MS } from './logic';

const PERIODOS: { chave: Period; rotulo: string }[] = [
  { chave: 'manha', rotulo: 'Manhã' },
  { chave: 'tarde', rotulo: 'Tarde' },
  { chave: 'noite', rotulo: 'Noite' },
];

const PASSO_MIN = 30;

export function SemanaScreen() {
  const { repo, clock, user, propostas: fonte, evento, emitirEvento, mostrarAviso, refresh, versao } = useApp();
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [analisando, setAnalisando] = useState(false);
  const [conhecendo, setConhecendo] = useState(false);
  const [proposta, setProposta] = useState<WeeklyProposal | null>(null);
  const [decisao, setDecisao] = useState<DecisaoFeita | null>(null);
  const [editando, setEditando] = useState<BlockSlot | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const gerando = useRef(false);
  const timerDesfazer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { estado } = useCarregar(async () => {
    if (!user) throw new Error('sem usuário');
    const dados = await carregarSemana(repo, clock, user);
    setProposta(dados.proposta);
    setConhecendo(false);
    if (!dados.proposta && !gerando.current) {
      gerando.current = true;
      setErro(null);
      setAnalisando(true);
      try {
        // Pequena pausa para o "pensando" ser visto; o cálculo em si é imediato.
        await new Promise((r) => setTimeout(r, 700));
        const out = await fonte.gerar(dados);
        if (out.kind === 'proposta') {
          setProposta(out.proposal);
          emitirEvento('surpreso');
        } else if (out.kind === 'existente') {
          setProposta(out.proposal);
        } else if (out.kind === 'conhecendo') {
          setConhecendo(true);
        }
      } catch (e) {
        // Só a fonte remota falha (rede ou servidor): a tela segue de pé com o aviso no lugar da ideia.
        setErro(mensagemDeErro(e));
      } finally {
        gerando.current = false;
        setAnalisando(false);
      }
    }
    return dados;
  });

  useEffect(() => () => clearTimeout(timerDesfazer.current), []);

  if (!user) return null;

  if (estado.tipo === 'carregando') {
    return (
      <Tela titulo="Semana">
        <View accessibilityRole="progressbar" accessibilityLabel="Carregando a semana" style={[styles.esqueleto, { backgroundColor: t.cores.line }]} />
      </Tela>
    );
  }
  if (estado.tipo === 'erro') {
    return (
      <Tela titulo="Semana">
        <EstadoVazio titulo="Sem sinal por aqui" texto="A lagoa ficou sem sinal. Seus dados estão salvos aqui." />
      </Tela>
    );
  }

  const d = estado.dados;
  const humor = estadoDoSapo({
    phase: d.mascote.phase,
    interruptedFocusToday: 0,
    focusRunning: false,
    aiAnalyzing: analisando,
    activeEvent: evento,
    withinUserDay: dentroDoDiaDoUsuario(user, d.hoje ? clock.now() : 0),
  });
  const lado = Math.min(Math.min(width, 480) - 32, 260);
  const r = d.resumo;

  const comDecisao = (dec: DecisaoFeita, mensagem: string) => {
    setProposta(dec.proposal);
    setDecisao(dec);
    setEditando(null);
    setErro(null);
    mostrarAviso({ mensagem });
    clearTimeout(timerDesfazer.current);
    timerDesfazer.current = setTimeout(() => setDecisao(null), JANELA_DE_DESFAZER_MS);
    refresh();
  };

  /** Falha de rede ou de sessão na fonte remota: o texto em português vai para a tela em vez de quebrar o fluxo. */
  const tentar = async (acao: () => Promise<void>) => {
    try {
      await acao();
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  };
  const aposDecisao = (res: Awaited<ReturnType<typeof fonte.aceitar>>, mensagem: string) => {
    if (res.ok) comDecisao(res.decisao, mensagem);
    else {
      setErro(res.mensagem);
      // O servidor recusou porque a tela estava desatualizada: recarrega para mostrar a semana como ela está.
      if (res.recarregar) refresh();
    }
  };

  const aoAceitar = () =>
    tentar(async () => {
      if (!proposta) return;
      aposDecisao(await fonte.aceitar(proposta), 'Pronto, ajustei seu bloco.');
    });
  const aoSalvarEdicao = () =>
    tentar(async () => {
      if (!proposta || !editando) return;
      aposDecisao(await fonte.editarHorario(proposta, 0, editando), 'Horário salvo do seu jeito.');
    });
  const aoNegar = () =>
    tentar(async () => {
      if (!proposta) return;
      setProposta(await fonte.negar(proposta));
      setErro(null);
      mostrarAviso({ mensagem: 'Tudo bem, sigo como está.' });
      refresh();
    });
  const aoDesfazer = () =>
    tentar(async () => {
      if (!decisao) return;
      const antes = await fonte.desfazer(decisao);
      clearTimeout(timerDesfazer.current);
      setDecisao(null);
      if (antes) {
        setProposta(antes);
        mostrarAviso({ mensagem: 'Desfeito. Seu bloco voltou ao lugar.' });
      } else {
        mostrarAviso({ mensagem: 'O tempo para desfazer passou.', variante: 'atencao' });
      }
      refresh();
    });

  const mudar = (delta: number) =>
    setEditando((e) => (e ? { ...e, startMinutes: Math.max(0, Math.min(24 * 60 - e.durationMinutes, e.startMinutes + delta)) } : e));

  return (
    <Tela titulo="Semana">
      <View style={styles.centro}>
        <Lagoa
          fase={d.mascote.phase}
          resumo={r}
          agora={agoraDaLagoa(user, clock.now(), d.mascote.careDays, d.descansoHoje)}
          estadoDoSapo={humor}
          tamanho={lado}
        />
      </View>

      <Secao titulo="Como foi até agora">
        <Cartao>
          <View style={styles.coluna}>
            {PERIODOS.map((p) => (
              <Texto key={p.chave}>
                {p.rotulo}: {r.focusMinutesByPeriod[p.chave]} min de foco
              </Texto>
            ))}
            <Texto cor="muted">
              {r.totalSessions} {r.totalSessions === 1 ? 'sessão' : 'sessões'}, {r.careDays} {r.careDays === 1 ? 'dia' : 'dias'} de cuidado, {r.restDays}{' '}
              {r.restDays === 1 ? 'dia' : 'dias'} de descanso
            </Texto>
            <Texto variante="subtitulo">{r.stable ? 'Semana estável. A lagoa está firme.' : 'A semana ainda está se formando.'}</Texto>
          </View>
        </Cartao>
      </Secao>

      <Secao titulo="Uma ideia para sua semana">
        {proposta && proposta.state !== 'negada' && proposta.state !== 'expirada' ? (
          <Cartao testID="cartao-proposta">
            <View style={styles.coluna}>
              <Texto variante="legenda" cor="muted">
                {proposalLabel(proposta.origin)}
              </Texto>
              <Texto>{proposta.patternText}</Texto>
              {proposta.reasonText ? <Texto cor="muted">{proposta.reasonText}</Texto> : null}
              {proposta.changes.map((c, i) => (
                <View key={`${c.blockId}-${i}`} style={styles.coluna}>
                  <Texto>Antes: {slotTexto(c.from)}</Texto>
                  <Texto variante="subtitulo">Depois: {slotTexto(i === 0 && editando ? editando : c.to)}</Texto>
                </View>
              ))}

              {proposta.state === 'pendente' && !editando && (
                <View style={styles.coluna}>
                  <Botao titulo="Aceitar" onPress={() => void aoAceitar()} />
                  <Botao titulo="Editar horário" variante="agua" onPress={() => setEditando({ ...proposta.changes[0].to })} />
                  <Botao titulo="Negar" variante="fantasma" onPress={() => void aoNegar()} />
                </View>
              )}

              {proposta.state === 'pendente' && editando && (
                <View style={styles.coluna}>
                  <View style={styles.linha}>
                    <Botao titulo="30 min antes" variante="fantasma" largura="auto" onPress={() => mudar(-PASSO_MIN)} />
                    <Botao titulo="30 min depois" variante="fantasma" largura="auto" onPress={() => mudar(PASSO_MIN)} />
                  </View>
                  <Botao titulo="Salvar horário" onPress={() => void aoSalvarEdicao()} />
                  <Botao titulo="Cancelar" variante="fantasma" onPress={() => setEditando(null)} />
                </View>
              )}

              {proposta.state !== 'pendente' && (
                <Texto variante="subtitulo">{proposta.state === 'editada' ? 'Você ajustou o horário.' : 'Você aceitou esta ideia.'}</Texto>
              )}
              {decisao ? <Botao titulo="Desfazer" variante="fantasma" onPress={() => void aoDesfazer()} testID="desfazer" /> : null}
              {erro ? <Texto cor="atencao">{erro}</Texto> : null}
            </View>
          </Cartao>
        ) : proposta?.state === 'negada' ? (
          <Texto cor="muted">Sem ideias novas por agora. Seguimos do seu jeito.</Texto>
        ) : analisando ? (
          <Texto cor="muted">Estou pensando na sua semana...</Texto>
        ) : conhecendo ? (
          <Cartao>
            <Texto>{GETTING_TO_KNOW_TEXT}. Mais alguns focos e eu volto com uma ideia.</Texto>
          </Cartao>
        ) : erro ? (
          <Texto cor="atencao">{erro}</Texto>
        ) : (
          <Texto cor="muted">Sem ideias por esta semana. Está tudo bem como está.</Texto>
        )}
      </Secao>
    </Tela>
  );
}

const styles = StyleSheet.create({
  esqueleto: { height: 240, borderRadius: 20, opacity: 0.6 },
  centro: { alignItems: 'center' },
  coluna: { gap: 8 },
  linha: { flexDirection: 'row', gap: 8 },
});
