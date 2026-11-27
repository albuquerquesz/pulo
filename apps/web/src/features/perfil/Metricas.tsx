import { useEffect, useRef } from 'react';

import type { ProfileMetrics } from '@pulo/core/domain/types';

import { Botao } from '@/ui';

import { useApp, useCarregar } from '../app';
import { carregarMetricas } from '../casca/metricas';
import { GraficosDoDescanso, GraficosDoRitmo } from './GraficosDoRitmo';
import { Secao } from './Secao';
import { carregarRegistros, type RegistrosDoRitmo } from './series';

/** O fim do endereço que traz a pessoa direto para cá. */
const ANCORA = 'metricas';

type DadosDaSecao = { metricas: ProfileMetrics; registros: RegistrosDoRitmo };

function Grupos({ metricas, registros }: DadosDaSecao) {
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="titulo-do-ritmo" className="flex min-w-0 flex-col gap-2">
        <h3 id="titulo-do-ritmo" className="font-extrabold text-muted">
          Ritmo
        </h3>
        <GraficosDoRitmo registros={registros} />
      </section>
      <section aria-labelledby="titulo-do-descanso" className="flex min-w-0 flex-col gap-2">
        <h3 id="titulo-do-descanso" className="font-extrabold text-muted">
          Descanso e concluído
        </h3>
        <GraficosDoDescanso registros={registros} guardados={metricas.gelo.guardados} />
      </section>
    </div>
  );
}

async function carregarSecao(...[repo, clock, versao]: Parameters<typeof carregarMetricas>): Promise<DadosDaSecao> {
  const metricas = await carregarMetricas(repo, clock, versao);
  return { metricas, registros: await carregarRegistros(repo, clock) };
}

/** A seção Métricas do Perfil. Quem chega por `#metricas` é levado até ela. */
export function Metricas() {
  const { repo, clock, versao } = useApp();
  const { estado, recarregar } = useCarregar(() => carregarSecao(repo, clock, versao));
  const alvo = useRef<HTMLDivElement>(null);
  const pronta = estado.tipo !== 'carregando';

  // Só rola quando os números chegaram, para a seção não mudar de lugar depois.
  useEffect(() => {
    if (!pronta || window.location.hash !== `#${ANCORA}`) return;
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    alvo.current?.scrollIntoView?.({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
    alvo.current?.focus({ preventScroll: true });
  }, [pronta]);

  return (
    <div ref={alvo} id={ANCORA} tabIndex={-1} className="scroll-mt-4">
      <Secao titulo="Métricas">
        {estado.tipo === 'ok' ? <Grupos {...estado.dados} /> : null}
        {estado.tipo === 'carregando' ? (
          <p role="status" className="text-muted">
            Somando seus números…
          </p>
        ) : null}
        {estado.tipo === 'erro' ? (
          <div role="alert" className="flex flex-col items-start gap-2 text-muted">
            Não consegui abrir as métricas.
            <Botao titulo="Tentar de novo" variante="fantasma" largura="auto" onPress={() => void recarregar()} />
          </div>
        ) : null}
      </Secao>
    </div>
  );
}
