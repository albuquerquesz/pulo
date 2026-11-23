import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MAX_HABITS_PER_DAY, WEEKLY_AI } from '@pulo/core/config/decisions';
import type { EntityId } from '@pulo/core/domain/types';
import { useTheme } from '@/theme';
import { Botao, Cartao, EstadoVazio, Texto } from '@/ui';

import { blocoTexto, confirmar, Secao, Tela, useApp, useCarregar } from '../app';
import { FormularioDeBloco } from './FormularioDeBloco';
import { FormularioDeHabito } from './FormularioDeHabito';
import {
  blocosPorDia,
  carregarRotina,
  descricaoDoBloco,
  desfazerEdicaoDeBloco,
  diasDoHabito,
  entradaDoBloco,
  entradaDoHabito,
  entradaVaziaDeBloco,
  entradaVaziaDeHabito,
  removerDoBloco,
  removerDoHabito,
  rotuloDoBloco,
  salvarBloco,
  salvarHabito,
  TEXTO_DE_ERRO,
  type DadosRotina,
  type EntradaDeBloco,
  type EntradaDeHabito,
} from './logic';

type Painel = { tipo: 'bloco'; id: EntityId | null } | { tipo: 'habito'; id: EntityId | null } | null;

export function RotinaScreen() {
  const { repo, clock, user, refresh, mostrarAviso } = useApp();
  const router = useRouter();
  const t = useTheme();
  const { estado, recarregar } = useCarregar(() => carregarRotina(repo));
  const [painel, setPainel] = useState<Painel>(null);

  if (!user) return null;

  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/perfil'));
  const cabecalho = (
    <Botao titulo="Voltar" rotulo="Voltar para o perfil" variante="fantasma" largura="auto" onPress={voltar} testID="voltar" />
  );

  if (estado.tipo === 'carregando') {
    return (
      <Tela titulo="Sua rotina" semBarra>
        {cabecalho}
        <View accessibilityLabel="Carregando sua rotina" accessibilityRole="progressbar" style={styles.esqueleto}>
          {[96, 72, 72, 120].map((altura, i) => (
            <View key={i} style={[styles.bloco, { height: altura, backgroundColor: t.cores.line }]} />
          ))}
        </View>
      </Tela>
    );
  }

  if (estado.tipo === 'erro') {
    return (
      <Tela titulo="Sua rotina" semBarra>
        {cabecalho}
        <EstadoVazio titulo="Sem sinal por aqui" texto={TEXTO_DE_ERRO} acao="Tentar de novo" onAcao={() => void recarregar()} />
      </Tela>
    );
  }

  const dados: DadosRotina = estado.dados;
  const vazio = dados.blocos.length === 0 && dados.habitos.length === 0;
  const inicioDoDia = user.dayStartMinutes;

  const salvarDoBloco = async (entrada: EntradaDeBloco) => {
    const editando = painel?.tipo === 'bloco' ? painel.id : null;
    const r = await salvarBloco(repo, clock, entrada, editando);
    if (!r.ok) return r;
    setPainel(null);
    refresh();
    const token = r.desfazer;
    if (token) {
      mostrarAviso(
        {
          mensagem: 'Bloco atualizado.',
          acao: 'Desfazer',
          onAcao: () => {
            void (async () => {
              try {
                const d = await desfazerEdicaoDeBloco(repo, clock, token);
                if (d.ok) refresh();
                else mostrarAviso({ mensagem: d.error.message, variante: 'atencao' });
              } catch {
                // Aviso de erro já mostrado pelo repositório.
              }
            })();
          },
        },
        WEEKLY_AI.undoSeconds * 1000,
      );
    } else {
      mostrarAviso({ mensagem: editando ? 'Bloco atualizado.' : 'Bloco criado.' });
    }
    return r;
  };

  const salvarDoHabito = async (entrada: EntradaDeHabito) => {
    const editando = painel?.tipo === 'habito' ? painel.id : null;
    const r = await salvarHabito(repo, clock, entrada, editando);
    if (!r.ok) return r;
    setPainel(null);
    refresh();
    mostrarAviso({ mensagem: editando ? 'Hábito atualizado.' : 'Hábito criado.' });
    return r;
  };

  const removerBlocoDaLista = async (id: EntityId, descricao: string) => {
    const ok = await confirmar('Remover este bloco?', `${descricao}. As sessões de foco já feitas continuam no seu histórico.`, 'Remover', 'Cancelar');
    if (!ok) return;
    try {
      await removerDoBloco(repo, id);
      if (painel?.tipo === 'bloco' && painel.id === id) setPainel(null);
      refresh();
      mostrarAviso({ mensagem: 'Bloco removido.' });
    } catch {
      // O aviso de erro já foi mostrado; o bloco continua na lista.
    }
  };

  const removerHabitoDaLista = async (id: EntityId, titulo: string) => {
    const ok = await confirmar('Remover este hábito?', `"${titulo}" e as marcações dele serão apagados. Não dá para desfazer.`, 'Remover', 'Cancelar');
    if (!ok) return;
    try {
      await removerDoHabito(repo, id);
      if (painel?.tipo === 'habito' && painel.id === id) setPainel(null);
      refresh();
      mostrarAviso({ mensagem: 'Hábito removido.' });
    } catch {
      // O aviso de erro já foi mostrado; o hábito continua na lista.
    }
  };

  const formularioDeBloco =
    painel?.tipo === 'bloco' ? (
      <FormularioDeBloco
        key={painel.id ?? 'novo'}
        titulo={painel.id ? 'Editar bloco' : 'Novo bloco'}
        inicial={painel.id ? entradaDoBloco(dados.blocos.find((b) => b.id === painel.id) ?? dados.blocos[0]) : entradaVaziaDeBloco(inicioDoDia)}
        onSalvar={salvarDoBloco}
        onCancelar={() => setPainel(null)}
      />
    ) : null;

  const formularioDeHabito =
    painel?.tipo === 'habito' ? (
      <FormularioDeHabito
        key={painel.id ?? 'novo'}
        titulo={painel.id ? 'Editar hábito' : 'Novo hábito'}
        inicial={painel.id ? entradaDoHabito(dados.habitos.find((h) => h.id === painel.id) ?? dados.habitos[0]) : entradaVaziaDeHabito}
        podePausar={painel.id !== null}
        onSalvar={salvarDoHabito}
        onCancelar={() => setPainel(null)}
      />
    ) : null;

  return (
    <Tela titulo="Sua rotina" semBarra>
      {cabecalho}
      <Texto cor="muted">Monte seus blocos de foco e descanso e os hábitos de cada dia. Você muda quando quiser.</Texto>

      {vazio && !painel ? (
        <EstadoVazio
          titulo="Sua rotina está vazia"
          texto="Comece com um bloco de foco ou um hábito pequeno. Dá para mudar depois."
          acao="Criar o primeiro bloco"
          onAcao={() => setPainel({ tipo: 'bloco', id: null })}
        />
      ) : null}

      <Secao titulo="Blocos da semana">
        {painel?.tipo === 'bloco' && painel.id === null ? (
          formularioDeBloco
        ) : (
          <Botao titulo="Novo bloco" variante="foco" onPress={() => setPainel({ tipo: 'bloco', id: null })} testID="novo-bloco" />
        )}
        {blocosPorDia(dados.blocos).map(({ dia, nome, blocos }) => (
          <View key={dia} style={styles.dia} accessibilityRole="summary">
            <Texto variante="subtitulo" accessibilityRole="header">
              {nome}
            </Texto>
            {blocos.length === 0 ? (
              <Texto variante="legenda" cor="muted">
                Sem blocos neste dia.
              </Texto>
            ) : (
              blocos.map((b) =>
                painel?.tipo === 'bloco' && painel.id === b.id ? (
                  <View key={b.id}>{formularioDeBloco}</View>
                ) : (
                  <Cartao key={b.id} testID={`bloco-${b.id}`}>
                    <View style={styles.linha}>
                      <View style={styles.linhaTexto}>
                        <Texto variante="subtitulo">{rotuloDoBloco(b)}</Texto>
                        <Texto variante="legenda" cor="muted">
                          {blocoTexto(b.startMinutes, b.durationMinutes)}, {b.durationMinutes} min, {b.kind === 'foco' ? 'foco' : 'descanso'}
                        </Texto>
                      </View>
                    </View>
                    <View style={styles.acoes}>
                      <Botao titulo="Editar" variante="fantasma" largura="auto" rotulo={`Editar bloco: ${descricaoDoBloco(b)}`} onPress={() => setPainel({ tipo: 'bloco', id: b.id })} />
                      <Botao titulo="Remover" variante="fantasma" largura="auto" rotulo={`Remover bloco: ${descricaoDoBloco(b)}`} onPress={() => void removerBlocoDaLista(b.id, descricaoDoBloco(b))} />
                    </View>
                  </Cartao>
                ),
              )
            )}
          </View>
        ))}
      </Secao>

      <Secao titulo="Hábitos">
        <Texto variante="legenda" cor="muted">
          Até {MAX_HABITS_PER_DAY} hábitos ativos por dia.
        </Texto>
        {painel?.tipo === 'habito' && painel.id === null ? (
          formularioDeHabito
        ) : (
          <Botao titulo="Novo hábito" variante="agua" onPress={() => setPainel({ tipo: 'habito', id: null })} testID="novo-habito" />
        )}
        {dados.habitos.length === 0 ? (
          <Texto cor="muted">Nenhum hábito ainda.</Texto>
        ) : (
          dados.habitos.map((h) =>
            painel?.tipo === 'habito' && painel.id === h.id ? (
              <View key={h.id}>{formularioDeHabito}</View>
            ) : (
              <Cartao key={h.id} testID={`habito-${h.id}`}>
                <View style={styles.linhaTexto}>
                  <Texto variante="subtitulo">{h.title}</Texto>
                  <Texto variante="legenda" cor="muted">
                    {diasDoHabito(h.weekdays)}
                    {h.active ? '' : ', pausado'}
                  </Texto>
                </View>
                <View style={styles.acoes}>
                  <Botao titulo="Editar" variante="fantasma" largura="auto" rotulo={`Editar hábito: ${h.title}`} onPress={() => setPainel({ tipo: 'habito', id: h.id })} />
                  <Botao titulo="Remover" variante="fantasma" largura="auto" rotulo={`Remover hábito: ${h.title}`} onPress={() => void removerHabitoDaLista(h.id, h.title)} />
                </View>
              </Cartao>
            ),
          )
        )}
      </Secao>
    </Tela>
  );
}

const styles = StyleSheet.create({
  esqueleto: { gap: 12 },
  bloco: { borderRadius: 20, opacity: 0.6 },
  dia: { gap: 8, marginTop: 8 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linhaTexto: { flex: 1 },
  acoes: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
