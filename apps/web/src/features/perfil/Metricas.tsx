import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

import type { ProfileMetrics } from '@pulo/core/domain/types';

import { Botao } from '@/ui';

import { useApp, useCarregar } from '../app';
import { carregarMetricas } from '../casca/metricas';
import { CARTAO } from './estilos';
import { GraficosDoDescanso, GraficosDoRitmo } from './GraficosDoRitmo';
import { Secao } from './Secao';
import { carregarRegistros, semRitmo, type RegistrosDoRitmo } from './series';

/** O fim do endereço que traz a pessoa direto para cá. */
const ANCORA = 'metricas';

type DadosDaSecao = { metricas: ProfileMetrics; registros: RegistrosDoRitmo };

/** Sem nenhum registro, os gráficos dão lugar ao primeiro passo. */
function SemRitmo() {
  const navegar = useNavigate();
  return (
    <div className={`${CARTAO} flex flex-col items-center gap-2 p-6 text-center`}>
      <span aria-hidden="true" className="mb-1 grid size-14 place-items-center rounded-full bg-sapo/22 text-[28px]">
        📈
      </span>
      <h3 className="text-base font-extrabold">Seu ritmo começa aqui</h3>
      <p className="text-sm text-muted">Depois do primeiro foco, os gráficos aparecem neste lugar.</p>
      <Botao titulo="Começar um foco" largura="auto" className="mt-2 self-center" onPress={() => void navegar({ to: '/casa' })} />
    </div>
  );
}

function Grupos({ metricas, registros }: DadosDaSecao) {
  if (semRitmo(registros)) return <SemRitmo />;
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
    const suave =
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches && document.documentElement.dataset.reduzirMovimento !== 'true';
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
