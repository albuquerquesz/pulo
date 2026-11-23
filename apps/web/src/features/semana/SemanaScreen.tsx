import { useEffect, useRef, useState } from 'react';

import { GETTING_TO_KNOW_TEXT, proposalLabel } from '@pulo/core/domain/ia';
import type { BlockSlot, Period, WeeklyProposal } from '@pulo/core/domain/types';
import { estadoDoSapo, Lagoa } from '@/mascot';
import { Botao, Cartao, EstadoVazio, Texto } from '@/ui';

import { agoraDaLagoa, dentroDoDiaDoUsuario, Secao, slotTexto, Tela, useApp, useCarregar, useLadoDoConteudo } from '../app';
import {
  aceitar,
  carregarSemana,
  desfazer,
  editarHorario,
  gerarEGuardarProposta,
  JANELA_DE_DESFAZER_MS,
  negar,
  type Decisao,
} from './logic';

type OpcaoDePeriodo = { chave: Period; rotulo: string };

const PERIODOS: OpcaoDePeriodo[] = [
  { chave: 'manha', rotulo: 'Manhã' },
  { chave: 'tarde', rotulo: 'Tarde' },
  { chave: 'noite', rotulo: 'Noite' },
];

const PASSO_MIN = 30;

export function SemanaScreen() {
  const { repo, clock, user, aiClient, evento, emitirEvento, mostrarAviso, refresh } = useApp();
  const ladoDoConteudo = useLadoDoConteudo();
  const [analisando, setAnalisando] = useState(false);
  const [conhecendo, setConhecendo] = useState(false);
  const [proposta, setProposta] = useState<WeeklyProposal | null>(null);
  const [decisao, setDecisao] = useState<Decisao | null>(null);
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
      setAnalisando(true);
      try {
        // Pequena pausa para o "pensando" ser visto; o cálculo em si é imediato.
        await new Promise((r) => setTimeout(r, 700));
        const out = await gerarEGuardarProposta(repo, clock, dados, aiClient);
        if (out.kind === 'proposta') {
          setProposta(out.proposal);
          emitirEvento('surpreso');
        } else if (out.kind === 'conhecendo') {
          setConhecendo(true);
        }
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
        <div role="progressbar" aria-label="Carregando a semana" className="h-60 rounded-md bg-line opacity-60" />
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
  const lado = Math.min(ladoDoConteudo, 260);
  const r = d.resumo;

  const comDecisao = (dec: Decisao, mensagem: string) => {
    setProposta(dec.proposal);
    setDecisao(dec);
    setEditando(null);
    setErro(null);
    mostrarAviso({ mensagem });
    clearTimeout(timerDesfazer.current);
    timerDesfazer.current = setTimeout(() => setDecisao(null), JANELA_DE_DESFAZER_MS);
    refresh();
  };

  const aoAceitar = async () => {
    if (!proposta) return;
    const res = await aceitar(repo, clock, proposta);
    if (res.ok) comDecisao(res.decisao, 'Pronto, ajustei seu bloco.');
    else setErro(res.mensagem);
  };
  const aoSalvarEdicao = async () => {
    if (!proposta || !editando) return;
    const res = await editarHorario(repo, clock, proposta, 0, editando);
    if (res.ok) comDecisao(res.decisao, 'Horário salvo do seu jeito.');
    else setErro(res.mensagem);
  };
  const aoNegar = async () => {
    if (!proposta) return;
    setProposta(await negar(repo, clock, proposta));
    mostrarAviso({ mensagem: 'Tudo bem, sigo como está.' });
    refresh();
  };
  const aoDesfazer = async () => {
    if (!decisao) return;
    const antes = await desfazer(repo, clock, decisao.undo);
    clearTimeout(timerDesfazer.current);
    setDecisao(null);
    if (antes) {
      setProposta(antes);
      mostrarAviso({ mensagem: 'Desfeito. Seu bloco voltou ao lugar.' });
    } else {
      mostrarAviso({ mensagem: 'O tempo para desfazer passou.', variante: 'atencao' });
    }
    refresh();
  };

  const mudar = (delta: number) =>
    setEditando((e) => (e ? { ...e, startMinutes: Math.max(0, Math.min(24 * 60 - e.durationMinutes, e.startMinutes + delta)) } : e));

  return (
    <Tela titulo="Semana">
      <div className="flex justify-center">
        <Lagoa
          fase={d.mascote.phase}
          resumo={r}
          agora={agoraDaLagoa(user, clock.now(), d.mascote.careDays, d.descansoHoje)}
          estadoDoSapo={humor}
          tamanho={lado}
        />
      </div>

      <Secao titulo="Como foi até agora">
        <Cartao>
          <div className="flex flex-col gap-2">
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
          </div>
        </Cartao>
      </Secao>

      <Secao titulo="Uma ideia para sua semana">
        {proposta && proposta.state !== 'negada' && proposta.state !== 'expirada' ? (
          <Cartao testID="cartao-proposta">
            <div className="flex flex-col gap-2">
              <Texto variante="legenda" cor="muted">
                {proposalLabel(proposta.origin)}
              </Texto>
              <Texto>{proposta.patternText}</Texto>
              {proposta.reasonText ? <Texto cor="muted">{proposta.reasonText}</Texto> : null}
              {proposta.changes.map((c, i) => (
                <div key={`${c.blockId}-${i}`} className="flex flex-col gap-2">
                  <Texto>Antes: {slotTexto(c.from)}</Texto>
                  <Texto variante="subtitulo">Depois: {slotTexto(i === 0 && editando ? editando : c.to)}</Texto>
                </div>
              ))}

              {proposta.state === 'pendente' && !editando && (
                <div className="flex flex-col gap-2">
                  <Botao titulo="Aceitar" onPress={() => void aoAceitar()} />
                  <Botao titulo="Editar horário" variante="agua" onPress={() => setEditando({ ...proposta.changes[0].to })} />
                  <Botao titulo="Negar" variante="fantasma" onPress={() => void aoNegar()} />
                </div>
              )}

              {proposta.state === 'pendente' && editando && (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Botao titulo="30 min antes" variante="fantasma" largura="auto" onPress={() => mudar(-PASSO_MIN)} />
                    <Botao titulo="30 min depois" variante="fantasma" largura="auto" onPress={() => mudar(PASSO_MIN)} />
                  </div>
                  <Botao titulo="Salvar horário" onPress={() => void aoSalvarEdicao()} />
                  <Botao titulo="Cancelar" variante="fantasma" onPress={() => setEditando(null)} />
                </div>
              )}

              {proposta.state !== 'pendente' && (
                <Texto variante="subtitulo">{proposta.state === 'editada' ? 'Você ajustou o horário.' : 'Você aceitou esta ideia.'}</Texto>
              )}
              {decisao ? <Botao titulo="Desfazer" variante="fantasma" onPress={() => void aoDesfazer()} testID="desfazer" /> : null}
              {erro ? <Texto cor="atencao">{erro}</Texto> : null}
            </div>
          </Cartao>
        ) : proposta?.state === 'negada' ? (
          <Texto cor="muted">Sem ideias novas por agora. Seguimos do seu jeito.</Texto>
        ) : analisando ? (
          <Texto cor="muted">Estou pensando na sua semana...</Texto>
        ) : conhecendo ? (
          <Cartao>
            <Texto>{GETTING_TO_KNOW_TEXT}. Mais alguns focos e check ins e eu volto com uma ideia.</Texto>
          </Cartao>
        ) : (
          <Texto cor="muted">Sem ideias por esta semana. Está tudo bem como está.</Texto>
        )}
      </Secao>
    </Tela>
  );
}
