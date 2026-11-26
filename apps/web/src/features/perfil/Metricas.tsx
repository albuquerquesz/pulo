import { useEffect, useId, useRef, type ReactNode } from 'react';

import type { ProfileMetrics } from '@pulo/core/domain/types';

import { Botao } from '@/ui';

import { useApp, useCarregar } from '../app';
import { carregarMetricas } from '../casca/metricas';
import { CARTAO } from './estilos';
import { Faixa, GraficosDoRitmo } from './GraficosDoRitmo';
import { numero } from './logic';
import { comparacaoDoDescanso, TEXTO_DE_POUCA_HISTORIA } from './metricas';
import { Secao } from './Secao';
import { carregarRegistros, type RegistrosDoRitmo } from './series';

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

type DadosDaSecao = { metricas: ProfileMetrics; registros: RegistrosDoRitmo };

/** Um grupo: o título fora do cartão. */
type GrupoProps = { titulo: string; /** Explicação curta, que aparece numa dica ao passar o mouse no ícone ao lado do título. */ ajuda?: string; children: ReactNode };

/** O ícone de ajuda com a dica: abre ao passar o mouse ou ao focar pelo teclado. */
function Ajuda({ titulo, texto }: { titulo: string; texto: string }) {
  const id = useId();
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={`Sobre ${titulo}`}
        aria-describedby={id}
        className="grid size-5 cursor-help place-items-center rounded-full border-[1.5px] border-muted/60 text-[11px] font-black text-muted hover:border-ink hover:text-ink"
      >
        ?
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 rounded-md border border-line bg-surface px-3 py-2 text-[13px] font-semibold text-ink opacity-0 shadow-md transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {texto}
      </span>
    </span>
  );
}

function Grupo({ titulo, ajuda, children }: GrupoProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 id={id} className="font-extrabold text-muted">
          {titulo}
        </h3>
        {ajuda ? <Ajuda titulo={titulo} texto={ajuda} /> : null}
      </div>
      <div className={`${CARTAO} flex flex-1 flex-col gap-4 p-5`}>{children}</div>
    </section>
  );
}

const NUMEROS = 'grid grid-cols-2 gap-4';

function DescansoEGelo({ descanso, gelo }: Pick<ProfileMetrics, 'descanso' | 'gelo'>) {
  const barras = comparacaoDoDescanso(descanso);
  return (
    <Grupo titulo="Descanso e gelo" ajuda={barras ? undefined : TEXTO_DE_POUCA_HISTORIA}>
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
      ) : null}
    </Grupo>
  );
}

function Grupos({ metricas, registros }: DadosDaSecao) {
  const { feitos } = metricas;
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="titulo-do-ritmo" className="flex min-w-0 flex-col gap-2">
        <h3 id="titulo-do-ritmo" className="font-extrabold text-muted">
          Ritmo
        </h3>
        <GraficosDoRitmo registros={registros} />
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
