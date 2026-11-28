import { useEffect, useRef } from 'react';

import { MINUTE_MS } from '@pulo/core/domain/clock';

import { useApp } from '../app';
import { ehConflito, encerrarFocoVencido, esperaDeNovaTentativa, reler, TEXTO_CONCLUIU_FORA } from './logic';

/**
 * Fora da Casa ninguém acompanha o relógio do foco: fecha o que venceu ao abrir cada tela e a cada minuto,
 * para os minutos, as joias e a sequência contarem. `ativo` desliga onde a própria tela cuida disso.
 */
export function useFocoVencido(ativo: boolean, caminho: string) {
  const { repo, clock, user, refresh, mostrarAviso, emitirEvento } = useApp();
  const tentativas = useRef({ falhas: 0, ate: 0, ocupado: false });
  const fazer = useRef(async () => {});
  useEffect(() => {
    fazer.current = async () => {
      const t = tentativas.current;
      if (!user || t.ocupado || clock.now() < t.ate) return;
      t.ocupado = true;
      try {
        // Depois de uma falha, só tenta de novo com o que o servidor tem agora.
        if (t.falhas > 0) await reler(repo);
        const estado = await encerrarFocoVencido(repo, clock, user);
        const recuperou = t.falhas > 0;
        t.falhas = 0;
        if (estado?.concluiuFora) {
          mostrarAviso({ mensagem: TEXTO_CONCLUIU_FORA });
          emitirEvento('feliz');
        }
        if (estado || recuperou) refresh();
      } catch (erro) {
        t.falhas += 1;
        t.ate = clock.now() + esperaDeNovaTentativa(t.falhas);
        if (ehConflito(erro)) await reler(repo).then(refresh, () => undefined);
      } finally {
        t.ocupado = false;
      }
    };
  });

  useEffect(() => {
    if (!ativo) return;
    void fazer.current();
    const id = setInterval(() => void fazer.current(), MINUTE_MS);
    return () => clearInterval(id);
  }, [ativo, caminho, user?.id]);
}
