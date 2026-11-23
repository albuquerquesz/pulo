import { useNavigate } from '@tanstack/react-router';
import { useCallback, useState } from 'react';

import { estadoDoSapo, Lagoa } from '@/mascot';
import { Botao, Cartao, EstadoVazio, Texto } from '@/ui';

import { agoraDaLagoa, blocoTexto, dentroDoDiaDoUsuario, Secao, Tela, useApp, useCarregar, useLadoDoConteudo } from '../app';
import {
  alternarHabito,
  carregarHoje,
  comecarFoco,
  concluirDescansoDoBloco,
  diaDeDescanso,
  progressoDaFase,
  type DadosHoje,
} from './logic';
import { criarPlanoInicial } from '@pulo/core/domain/routine';

export const TEXTO_DE_ERRO = 'A lagoa ficou sem sinal. Seus dados estão salvos aqui.';

export function HojeScreen() {
  const app = useApp();
  const { repo, clock, user, evento, emitirEvento, mostrarAviso, refresh } = app;
  const navigate = useNavigate();
  const lado = useLadoDoConteudo();
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

  if (!user) return null;

  if (estado.tipo === 'carregando') {
    return (
      <Tela titulo="Hoje">
        <div aria-label="Carregando a lagoa" role="progressbar" className="flex flex-col gap-3">
          <div className="rounded-md bg-line opacity-60" style={{ height: lado * 0.6 }} />
          <div className="h-12 rounded-md bg-line opacity-60" />
          <div className="h-24 rounded-md bg-line opacity-60" />
        </div>
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
    interruptedFocusToday: d.focosInterrompidosHoje,
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
    await navigate({ to: '/foco' });
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

  const proximo = d.proximoBloco;

  return (
    <Tela titulo="Hoje">
      <div className="flex justify-center">
        <Lagoa
          fase={d.mascote.phase}
          resumo={d.resumo}
          agora={agoraDaLagoa(user, d.agora, d.mascote.careDays, d.descansoHoje)}
          estadoDoSapo={humor}
          tamanho={lado}
          saltoDoSapo={salto}
        />
      </div>
      {d.sessaoAtiva ? (
        <Botao titulo="Voltar ao foco" variante="foco" rotulo="Voltar ao foco em andamento" onPress={() => void comecar()} testID="comecar-foco" />
      ) : null}

      <Secao titulo="Hábitos de hoje">
        {d.habitos.length === 0 ? (
          <Texto cor="muted">Nenhum hábito para hoje.</Texto>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {d.habitos.map(({ habito: h, feito }) => (
              <button
                key={h.id}
                type="button"
                onClick={() => void habito(h.id, feito)}
                role="checkbox"
                aria-label={h.title}
                aria-checked={feito}
                className={`flex min-h-24 cursor-pointer flex-col justify-between gap-3 rounded-md border border-b-4 p-3 text-left transition-transform duration-75 active:translate-y-[2px] ${
                  feito ? 'border-sapo-borda bg-sapo' : 'border-line bg-surface'
                }`}
              >
                <span
                  className={`flex size-7 items-center justify-center rounded-full border-2 ${feito ? 'border-ink-sobre-acao' : 'border-muted'}`}
                  aria-hidden="true"
                >
                  {feito ? (
                    <Texto como="span" variante="legenda" cor="inkSobreAcao">
                      ✓
                    </Texto>
                  ) : null}
                </span>
                <Texto como="span" variante="subtitulo" cor={feito ? 'inkSobreAcao' : undefined} className="line-clamp-2">
                  {h.title}
                </Texto>
              </button>
            ))}
          </div>
        )}
        <Texto variante="legenda" cor="muted">
          {textoDoProgresso(d)}
        </Texto>
      </Secao>

      <Secao titulo="Próximo bloco">
        {proximo ? (
          <Cartao className="flex-row items-center justify-between gap-3">
            <div className="flex-1">
              <Texto variante="subtitulo">
                {proximo.bloco.title ?? (proximo.bloco.kind === 'foco' ? 'Foco' : 'Descanso')}
              </Texto>
              <Texto cor="muted" variante="legenda">
                {blocoTexto(proximo.bloco.startMinutes, proximo.bloco.durationMinutes)}
              </Texto>
            </div>
            {proximo.bloco.kind === 'foco' ? (
              d.sessaoAtiva ? null : (
                <Botao
                  titulo="Focar"
                  variante="foco"
                  largura="auto"
                  rotulo={`Começar foco do bloco das ${blocoTexto(proximo.bloco.startMinutes, proximo.bloco.durationMinutes)}`}
                  onPress={() => void comecar(proximo.bloco)}
                  testID="comecar-foco"
                />
              )
            ) : (
              <Botao titulo="Feito" variante="agua" largura="auto" rotulo="Marcar descanso como feito" onPress={() => void descansoDoBloco(proximo.bloco.id)} />
            )}
          </Cartao>
        ) : (
          <>
            <Texto cor="muted">Sem mais blocos por hoje.</Texto>
            {d.sessaoAtiva ? null : (
              <Botao titulo="Começar um foco livre" variante="agua" rotulo="Começar foco de 25 minutos" onPress={() => void comecar()} testID="comecar-foco" />
            )}
          </>
        )}
      </Secao>

      <Botao
        titulo={d.descansoHoje ? 'Hoje é dia de descanso' : 'Tirar o dia de descanso'}
        variante="fantasma"
        desativado={d.descansoHoje}
        rotulo="Marcar hoje como dia de descanso"
        onPress={() => void descansar()}
      />
    </Tela>
  );
}

function textoDoProgresso(d: DadosHoje): string {
  const feitos = d.habitos.filter((h) => h.feito).length;
  const total = d.habitos.length;
  const habitos = total > 0 ? `${feitos} de ${total} ${total === 1 ? 'hábito' : 'hábitos'} hoje. ` : '';
  const dias = d.mascote.careDays === 1 ? '1 dia de cuidado' : `${d.mascote.careDays} dias de cuidado`;
  const { faltam } = progressoDaFase(d.mascote.phase, d.mascote.careDays);
  if (faltam === null) return `${habitos}${dias}, a lagoa está completa.`;
  return `${habitos}${dias}, ${faltam === 1 ? 'falta 1' : `faltam ${faltam}`} para a próxima fase.`;
}
