import { useCallback, useEffect, useRef, useState } from 'react';

import { timerSnapshot } from '@pulo/core/domain/foco';
import { joiasDoFoco } from '@pulo/core/domain/joias';

import { useApp } from '../app';
import { abrirFoco, concluir, iniciar, parar, retomar, TEXTO_CONCLUIU_FORA, type EstadoDoFoco, type ExtrasDoFoco } from '../foco/logic';
import { joiasEstimadas } from './logic';

/**
 * O foco da Casa: começar, parar e terminar sozinho no tempo. A contagem não vai para a tela.
 * `aoGanhar` é chamado quando a estimativa de joias sobe (o +1 que sai do sapo).
 */
export function useFoco(aoGanhar: (joias: number) => void) {
  const { repo, clock, user, versao, refresh, emitirEvento, mostrarAviso } = useApp();
  const [estado, setEstado] = useState<EstadoDoFoco | null>(null);
  const [estimativa, setEstimativa] = useState(0);
  const mostradas = useRef(0);
  const ocupado = useRef(false);
  const ganhar = useRef(aoGanhar);
  useEffect(() => {
    ganhar.current = aoGanhar;
  });

  const anunciar = useCallback((total: number) => {
    if (total > mostradas.current) ganhar.current(total - mostradas.current);
    mostradas.current = total;
    setEstimativa(total);
  }, []);

  const aplicar = useCallback(
    (e: EstadoDoFoco) => {
      setEstado(e);
      if (e.fase === 'ativa') return;
      // Ao acabar, o +1 que faltava sai com a conta de verdade da sessão.
      if (e.sessao && !e.concluiuFora) anunciar(joiasDoFoco(e.sessao));
      mostradas.current = 0;
      setEstimativa(0);
      if (e.concluiuFora) mostrarAviso({ mensagem: TEXTO_CONCLUIU_FORA });
      if (e.feliz) emitirEvento('feliz');
      if (e.marco) {
        emitirEvento('pouso');
        mostrarAviso({ mensagem: 'Seu sapo cresceu! Olha só a lagoa nova.' });
      }
      refresh();
    },
    [anunciar, emitirEvento, mostrarAviso, refresh],
  );

  /** Uma ação de cada vez; a recusa do servidor já foi avisada pelo repositório. */
  const executar = useCallback(
    async (acao: () => Promise<EstadoDoFoco>, depois: (e: EstadoDoFoco) => void = aplicar) => {
      if (ocupado.current) return;
      ocupado.current = true;
      try {
        depois(await acao());
      } catch {
        // A tela fica como estava.
      } finally {
        ocupado.current = false;
      }
    },
    [aplicar],
  );

  // Ao abrir (ou ao mudar a versão): uma sessão em andamento volta direto, sem repetir o +1 do que já passou.
  useEffect(() => {
    if (!user) return;
    void executar(
      async () => {
        const aberto = await abrirFoco(repo, clock, user);
        // A Casa não tem pausa: uma sessão pausada em outra tela ou aparelho volta a andar.
        return aberto.sessao?.pausedSince === undefined || aberto.fase !== 'ativa' ? aberto : retomar(repo, clock, user);
      },
      (e) => {
        if (e.fase === 'ativa' && e.sessao) {
          mostradas.current = joiasEstimadas(e.sessao, clock.now());
          setEstimativa(mostradas.current);
          setEstado(e);
        } else if (e.fase === 'concluida') aplicar(e);
        else setEstado((atual) => (atual?.fase === 'ativa' ? e : (atual ?? e)));
      },
    );
  }, [repo, clock, user, versao, executar, aplicar]);

  const sessao = estado?.fase === 'ativa' ? estado.sessao : null;
  useEffect(() => {
    if (!sessao || !user) return;
    const id = setInterval(() => {
      const agora = clock.now();
      if (timerSnapshot(sessao, agora).state === 'concluido') void executar(() => concluir(repo, clock, user));
      else anunciar(joiasEstimadas(sessao, agora));
    }, 1000);
    return () => clearInterval(id);
  }, [sessao, repo, clock, user, executar, anunciar]);

  return {
    focando: sessao !== null,
    /** Joias a somar ao saldo enquanto o foco roda. */
    estimativa,
    comecar: async (minutos: number, extras: ExtrasDoFoco) => {
      if (!user) return;
      await executar(async () => {
        const e = await iniciar(repo, clock, user, minutos, extras);
        mostradas.current = 0;
        return e;
      });
    },
    parar: async () => {
      if (user) await executar(() => parar(repo, clock, user));
    },
  };
}
