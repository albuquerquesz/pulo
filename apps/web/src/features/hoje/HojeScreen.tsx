import { useNavigate } from '@tanstack/react-router';
import { useCallback, useState } from 'react';

import { CHECKIN_LOW_ENERGY_COPY, CHECKIN_QUESTION } from '@pulo/core/domain/checkin';
import { estadoDoSapo, Lagoa } from '@/mascot';
import { Balao, Botao, Cartao, ChipEnergia, EstadoVazio, Texto } from '@/ui';
import type { Energy } from '@pulo/core/domain/types';

import { agoraDaLagoa, blocoTexto, dentroDoDiaDoUsuario, Secao, Tela, useApp, useCarregar, useLadoDoConteudo } from '../app';
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
import { criarPlanoInicial } from '@pulo/core/domain/routine';

const ENERGIAS: Energy[] = [1, 2, 3, 4, 5];

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
    await navigate({ to: '/foco' });
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
      <Balao texto={fraseDoSapo(humor, d)} />

      <Secao titulo={CHECKIN_QUESTION}>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Energia agora">
          {ENERGIAS.map((n) => (
            <ChipEnergia key={n} nivel={n} selecionado={d.energia === n} onPress={(v) => void energia(v)} />
          ))}
        </div>
        {d.energia !== null && d.energia <= 2 ? (
          <Cartao>
            <Texto>{CHECKIN_LOW_ENERGY_COPY}</Texto>
            <Botao titulo="Quero um dia de descanso" variante="agua" onPress={() => void descansar()} desativado={d.descansoHoje} />
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
            <Cartao key={bloco.id} className="flex-row items-center justify-between">
              <div className="flex-1">
                <Texto variante="subtitulo">{bloco.title ?? (bloco.kind === 'foco' ? 'Foco' : 'Descanso')}</Texto>
                <Texto cor="muted" variante="legenda">
                  {blocoTexto(bloco.startMinutes, bloco.durationMinutes)}
                  {feito ? ', feito' : ''}
                </Texto>
              </div>
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
            <button
              key={h.id}
              type="button"
              onClick={() => void habito(h.id, feito)}
              role="checkbox"
              aria-label={h.title}
              aria-checked={feito}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border bg-surface px-3 text-left ${feito ? 'border-sapo-borda' : 'border-line'}`}
            >
              <span className={`flex size-7 items-center justify-center rounded-[8px] border-2 ${feito ? 'border-sapo-borda bg-sapo' : 'border-muted'}`}>
                {feito ? (
                  <Texto como="span" variante="legenda" cor="inkSobreAcao">
                    ✓
                  </Texto>
                ) : null}
              </span>
              <Texto como="span" className={feito ? 'line-through opacity-70' : ''}>
                {h.title}
              </Texto>
            </button>
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
