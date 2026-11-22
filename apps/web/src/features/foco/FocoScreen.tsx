import { useCallback, useEffect, useRef, useState } from 'react';

import { CHECKIN_QUESTION } from '@pulo/core/domain/checkin';
import { timerSnapshot } from '@pulo/core/domain/foco';
import type { Energy, FrogEvent } from '@pulo/core/domain/types';
import { Sapo } from '@/mascot';
import { AnelTimer, Balao, Botao, ChipEnergia, Texto, type EstadoDoAnel } from '@/ui';

import { confirmar, Tela, useApp } from '../app';
import { registrarEnergia } from '../hoje/logic';
import {
  abrirFoco,
  concluir,
  FOCO_OCIOSO,
  iniciar,
  parar,
  pausar,
  retomar,
  TEXTO_CONCLUIU_FORA,
  TEXTO_PARAR,
  TEXTO_PARAR_DETALHE,
  type EstadoDoFoco,
} from './logic';

const ENERGIAS: Energy[] = [1, 2, 3, 4, 5];

export function FocoScreen() {
  const { repo, clock, user, versao, refresh, emitirEvento, evento, mostrarAviso } = useApp();
  const [estado, setEstado] = useState<EstadoDoFoco>(FOCO_OCIOSO);
  const [, setTique] = useState(0);
  const [confirmando, setConfirmando] = useState(false);
  const [respondeu, setRespondeu] = useState(false);
  const concluindo = useRef(false);

  const aplicar = useCallback(
    (e: EstadoDoFoco) => {
      setEstado(e);
      if (e.fase === 'concluida' || e.fase === 'interrompida') setRespondeu(false);
      if (e.feliz) emitirEvento('feliz');
      if (e.marco) {
        emitirEvento('pouso');
        mostrarAviso({ mensagem: 'Seu sapo cresceu! Olha só a lagoa nova.' });
      }
      refresh();
    },
    [emitirEvento, mostrarAviso, refresh],
  );

  // Ao abrir a tela (ou ao mudar a versão), lê a sessão. Sessão em andamento aparece direto.
  useEffect(() => {
    if (!user) return;
    let vivo = true;
    void abrirFoco(repo, clock, user).then((e) => {
      if (!vivo) return;
      // Não apaga o resultado recém mostrado (concluída ou interrompida) se nada está em andamento.
      setEstado((atual) => (e.fase === 'ocioso' && (atual.fase === 'concluida' || atual.fase === 'interrompida') ? atual : e));
      if (e.fase === 'concluida') {
        setRespondeu(false);
        if (e.feliz) emitirEvento('feliz');
        if (e.marco) {
          emitirEvento('pouso');
          mostrarAviso({ mensagem: 'Seu sapo cresceu! Olha só a lagoa nova.' });
        }
        refresh();
      }
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, clock, user, versao]);

  // O relógio de tela só redesenha: o valor sempre vem da conta por horário.
  const ativa = estado.fase === 'ativa';
  useEffect(() => {
    if (!ativa) return;
    const id = setInterval(() => setTique((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [ativa]);

  // Se o tempo acabou com a tela aberta, o domínio conclui.
  const agora = clock.now();
  const snap = timerSnapshot(estado.fase === 'ativa' ? estado.sessao : null, agora);
  useEffect(() => {
    if (!user || estado.fase !== 'ativa' || snap.state !== 'concluido' || concluindo.current) return;
    concluindo.current = true;
    void concluir(repo, clock, user)
      .then(aplicar)
      .finally(() => {
        concluindo.current = false;
      });
  });

  if (!user) return null;

  const total = (estado.sessao?.plannedMinutes ?? 25) * 60_000;
  const anel: EstadoDoAnel = !ativa ? (estado.fase === 'concluida' ? 'concluido' : 'parado') : snap.state === 'pausado' ? 'pausa' : 'rodando';
  const restante = ativa ? snap.remainingMs : estado.fase === 'concluida' ? 0 : total;
  const humor = estado.fase === 'concluida' && !evento ? 'feliz' : ativa ? 'focado' : 'parado';

  const pedirParar = async () => {
    setConfirmando(true);
    const ok = await confirmar(TEXTO_PARAR, TEXTO_PARAR_DETALHE);
    setConfirmando(false);
    if (ok) aplicar(await parar(repo, clock, user));
  };

  const energia = async (n: Energy) => {
    await registrarEnergia(repo, clock, user, n);
    setRespondeu(true);
    refresh();
  };

  return (
    <Tela titulo="Foco">
      <div className="flex flex-col items-center gap-2">
        <FocoSapo evento={evento} humor={humor} />
        <AnelTimer remainingMs={restante} totalMs={total} estado={anel} testID="anel-timer" />
      </div>

      {estado.fase === 'ocioso' && (
        <>
          <Balao texto="Pronto para um foco de 25 minutos? Eu fico com você." rabo="cima" />
          <Botao titulo="Começar foco" variante="foco" onPress={async () => aplicar(await iniciar(repo, clock, user))} testID="iniciar-foco" />
        </>
      )}

      {ativa && (
        <div className="flex flex-col gap-3">
          {snap.state === 'pausado' ? (
            <Botao titulo="Retomar" variante="foco" onPress={async () => aplicar(await retomar(repo, clock, user))} />
          ) : (
            <Botao titulo="Pausar" variante="agua" onPress={async () => aplicar(await pausar(repo, clock, user))} />
          )}
          <Botao titulo="Parar por agora" variante="fantasma" desativado={confirmando} rotulo="Parar o foco por agora" onPress={() => void pedirParar()} />
        </div>
      )}

      {estado.fase === 'concluida' && (
        <>
          <Balao
            texto={estado.concluiuFora ? TEXTO_CONCLUIU_FORA : 'Foco concluído. Que pulo bom!'}
            rabo="cima"
            testID="foco-concluido"
          />
          {estado.perguntarEnergia && !respondeu ? (
            <div className="flex flex-col gap-3">
              <Texto variante="subtitulo">{CHECKIN_QUESTION}</Texto>
              <div className="flex flex-wrap gap-2">
                {ENERGIAS.map((n) => (
                  <ChipEnergia key={n} nivel={n} onPress={(v) => void energia(v)} />
                ))}
              </div>
              <Botao titulo="Agora não" variante="fantasma" onPress={() => setRespondeu(true)} />
            </div>
          ) : null}
          <Botao titulo="Novo foco" variante="foco" onPress={async () => aplicar(await iniciar(repo, clock, user))} />
        </>
      )}

      {estado.fase === 'interrompida' && (
        <>
          <Balao texto="Tudo bem parar por agora. O que você fez conta." rabo="cima" />
          <Botao titulo="Recomeçar" variante="foco" onPress={async () => aplicar(await iniciar(repo, clock, user))} />
        </>
      )}
    </Tela>
  );
}

type FocoSapoProps = { evento: FrogEvent | null; humor: 'feliz' | 'focado' | 'parado' };

function FocoSapo({ evento, humor }: FocoSapoProps) {
  const { user, repo, versao } = useApp();
  const [fase, setFase] = useState<1 | 2 | 3 | 4>(1);
  useEffect(() => {
    void repo.getMascotState().then((m) => m && setFase(m.phase));
  }, [repo, versao, user]);
  const estado = evento === 'pouso' || evento === 'surpreso' || evento === 'feliz' ? evento : humor;
  return <Sapo fase={fase} estado={estado} tamanho={200} />;
}
