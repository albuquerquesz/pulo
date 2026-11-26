import { useEffect, useId, useRef, type ReactNode } from 'react';

import { METRICAS } from '@pulo/core/config/decisions';
import type { ProfileMetrics } from '@pulo/core/domain/types';

import { Botao } from '@/ui';

import { useApp, useCarregar } from '../app';
import { carregarMetricas } from '../casca/metricas';
import { duracaoTexto } from '../hoje/logic';
import { CARTAO } from './estilos';
import { Faixa, GraficosDoRitmo } from './GraficosDoRitmo';
import { numero } from './logic';
import { comparacaoDoDescanso, nomeDoDia, nomeDoPeriodo, porcentagem, TEXTO_DE_POUCA_HISTORIA } from './metricas';
import { Secao } from './Secao';
import { carregarSeries, type SeriesDoRitmo } from './series';

/** O fim do endereço que traz a pessoa direto para cá. */
const ANCORA = 'metricas';

type ItemProps = { valor: string; legenda: string; cor?: string };

function Item({ valor, legenda, cor = 'text-ink' }: ItemProps) {
  return (
    <div className="flex min-w-0 flex-col justify-start">
      <dt className="text-[13px] text-muted first-letter:uppercase">{legenda}</dt>
      <dd className={`text-2xl leading-tight font-extrabold break-words ${cor}`}>{valor}</dd>
    </div>
  );
}

type DadosDaSecao = { metricas: ProfileMetrics; series: SeriesDoRitmo };

/** Um grupo: o título fora do cartão. */
function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-2">
      <h3 id={id} className="font-extrabold text-muted">
        {titulo}
      </h3>
      <div className={`${CARTAO} flex flex-1 flex-col gap-4 p-5`}>{children}</div>
    </section>
  );
}

const NUMEROS = 'grid grid-cols-2 gap-4';

function DescansoEGelo({ descanso, gelo }: Pick<ProfileMetrics, 'descanso' | 'gelo'>) {
  const barras = comparacaoDoDescanso(descanso);
  return (
    <Grupo titulo="Descanso e gelo">
      <dl className={NUMEROS}>
        <Item valor={numero(descanso.total)} legenda="descansos no total" cor="text-descanso" />
        <Item valor={numero(descanso.noMes)} legenda="descansos no mês" cor="text-descanso" />
        <Item valor={numero(gelo.usadosTotal)} legenda="gelos usados" cor="text-agua" />
        <Item valor={numero(gelo.guardados)} legenda="gelos guardados" cor="text-agua" />
      </dl>
      {barras ? (
        <ul aria-label="Foco médio por semana" className="flex flex-col gap-3 border-t border-line pt-4">
          {barras.map((barra) => (
            <Faixa key={barra.rotulo} rotulo={barra.rotulo} texto={barra.texto} largura={barra.largura} cor={barra.comDescanso ? 'bg-descanso' : 'bg-sapo'} />
          ))}
        </ul>
      ) : (
        <p className="border-t border-line pt-4 text-sm text-muted">{TEXTO_DE_POUCA_HISTORIA}</p>
      )}
    </Grupo>
  );
}

function Grupos({ metricas, series }: DadosDaSecao) {
  const { ritmo, feitos } = metricas;
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="titulo-do-ritmo" className="flex min-w-0 flex-col gap-2">
        <h3 id="titulo-do-ritmo" className="font-extrabold text-muted">
          Ritmo
        </h3>
        <GraficosDoRitmo
          series={series}
          periodo={`Últimos ${METRICAS.janelaDias} dias`}
          numeros={{
            foco: [
              { legenda: 'Foco médio por dia', valor: duracaoTexto(ritmo.focoMedioPorDia30) },
              { legenda: 'Sessões terminadas', valor: numero(ritmo.sessoesTerminadas) },
              { legenda: 'Melhor período', valor: nomeDoPeriodo(ritmo.melhorPeriodo) },
            ],
            habitos: [
              { legenda: 'Hábitos feitos', valor: porcentagem(ritmo.taxaHabitos30) },
              { legenda: 'Melhor dia da semana', valor: nomeDoDia(ritmo.melhorDiaDaSemana) },
            ],
          }}
        />
      </section>
      <div className="grid gap-4 @2xl:grid-cols-2">
        <DescansoEGelo descanso={metricas.descanso} gelo={metricas.gelo} />
        <Grupo titulo="Concluído">
          <dl className={NUMEROS}>
            <Item valor={numero(feitos.tarefasConcluidas)} legenda="tarefas concluídas" />
            <Item valor={numero(feitos.metasConcluidas)} legenda="metas concluídas" />
            <Item valor={numero(feitos.joiasGanhas)} legenda="joias ganhas" cor="text-numero-joia" />
          </dl>
        </Grupo>
      </div>
    </div>
  );
}

async function carregarSecao(...[repo, clock, versao]: Parameters<typeof carregarMetricas>): Promise<DadosDaSecao> {
  const metricas = await carregarMetricas(repo, clock, versao);
  return { metricas, series: await carregarSeries(repo, clock) };
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
