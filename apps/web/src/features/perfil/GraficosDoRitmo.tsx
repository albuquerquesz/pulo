import { useId, type ReactNode } from 'react';

import type { Period } from '@pulo/core/domain/types';

import { nomeDoPeriodo } from './metricas';
import type { FaixaDoPeriodo, Serie, SeriesDoRitmo } from './series';

const SEM_FOCO = 'Faça um foco para ver os gráficos de foco aqui.';
const SEM_HABITOS = 'Marque um hábito para ver sua taxa por semana.';

type QuadroProps = { titulo: string; className?: string; children: ReactNode };

function Quadro({ titulo, className = '', children }: QuadroProps) {
  const id = useId();
  return (
    <figure aria-labelledby={id} className={`relative flex min-w-0 flex-col gap-3 ${className}`}>
      <figcaption id={id} className="text-[13px] font-extrabold text-muted">
        {titulo}
      </figcaption>
      {children}
    </figure>
  );
}

type ColunasProps = {
  serie: Serie;
  /** Classes da barra comum e da barra em destaque. */
  cor: string;
  corDoDestaque: string;
  /** Nas séries curtas, todas as colunas têm rótulo, no meio. Nas longas, só algumas, e a última encosta na direita. */
  longa?: boolean;
};

function posicaoDoRotulo(longa: boolean, ultima: boolean): string {
  return longa && ultima ? 'right-0' : 'left-1/2 -translate-x-1/2';
}

/** Barras em pé com o eixo à esquerda. O desenho fica fora do leitor de tela, que recebe a tabela. */
function Colunas({ serie: { colunas, eixo }, cor, corDoDestaque, longa = false }: ColunasProps) {
  const vao = longa ? 'gap-px @xl:gap-1' : 'gap-1.5';
  return (
    <>
      <div aria-hidden="true" className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1">
        <div className="flex h-32 flex-col justify-between text-right text-[11px] leading-none text-muted">
          {eixo.map((marca) => (
            <span key={marca}>{marca}</span>
          ))}
        </div>
        <div className="relative h-32">
          <div className="absolute inset-0 flex flex-col justify-between">
            {eixo.map((marca) => (
              <span key={marca} className="border-t border-line" />
            ))}
          </div>
          <div className={`relative flex h-full items-end ${vao}`}>
            {colunas.map((coluna) => (
              <span key={coluna.chave} title={`${coluna.nome}: ${coluna.texto}`} className="flex h-full flex-1 items-end justify-center">
                <i className={`block w-full max-w-8 rounded-t-[4px] ${coluna.destaque ? corDoDestaque : cor}`} style={{ height: `${coluna.altura}%` }} />
              </span>
            ))}
          </div>
        </div>
        <span />
        <div className={`flex ${vao}`}>
          {colunas.map((coluna, i) => (
            <span key={coluna.chave} className="relative h-4 flex-1">
              <span
                className={`absolute top-0 text-[11px] whitespace-nowrap ${coluna.destaque ? 'font-extrabold text-ink' : 'text-muted'} ${posicaoDoRotulo(longa, i === colunas.length - 1)}`}
              >
                {coluna.rotulo}
              </span>
            </span>
          ))}
        </div>
      </div>
      <div className="sr-only">
        <table>
          <tbody>
            {colunas.map((coluna) => (
              <tr key={coluna.chave}>
                <th scope="row">{coluna.nome}</th>
                <td>{coluna.texto}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const COR_DO_PERIODO: Record<Period, string> = { manha: 'bg-sol', tarde: 'bg-foco', noite: 'bg-descanso' };

type FaixaProps = { rotulo: string; texto: string; largura: number; cor: string };

/** Uma barra deitada, com o nome e o valor em cima. */
export function Faixa({ rotulo, texto, largura, cor }: FaixaProps) {
  return (
    <li className="flex flex-col gap-1">
      <span className="flex justify-between gap-3 text-[13px]">
        <span className="text-muted first-letter:uppercase">{rotulo}</span>
        <b>{texto}</b>
      </span>
      <span aria-hidden="true" className="block h-[18px] overflow-hidden rounded-full bg-line">
        <i className={`block h-full rounded-full ${cor}`} style={{ width: `${largura}%` }} />
      </span>
    </li>
  );
}

type PeriodosProps = { faixas: FaixaDoPeriodo[] };

function Periodos({ faixas }: PeriodosProps) {
  return (
    <ul className="flex flex-1 flex-col justify-center gap-3">
      {faixas.map((faixa) => (
        <Faixa key={faixa.periodo} rotulo={nomeDoPeriodo(faixa.periodo)} texto={faixa.texto} largura={faixa.largura} cor={COR_DO_PERIODO[faixa.periodo]} />
      ))}
    </ul>
  );
}

const VAZIO = 'text-sm text-muted';

type GraficosProps = { series: SeriesDoRitmo };

export function GraficosDoRitmo({ series: { porDia, porPeriodo, porDiaDaSemana, habitosPorSemana } }: GraficosProps) {
  return (
    <div className="grid gap-6 border-t border-line pt-4 @2xl:grid-cols-3">
      {porDia ? (
        <Quadro titulo="Foco por dia" className="@2xl:col-span-3">
          <Colunas serie={porDia} cor="bg-foco/45" corDoDestaque="bg-foco" longa />
        </Quadro>
      ) : (
        <p className={`${VAZIO} @2xl:col-span-3`}>{SEM_FOCO}</p>
      )}
      {porPeriodo ? (
        <Quadro titulo="Foco por período">
          <Periodos faixas={porPeriodo} />
        </Quadro>
      ) : null}
      {porDiaDaSemana ? (
        <Quadro titulo="Foco por dia da semana">
          <Colunas serie={porDiaDaSemana} cor="bg-agua/45" corDoDestaque="bg-agua" />
        </Quadro>
      ) : null}
      {habitosPorSemana ? (
        <Quadro titulo="Hábitos feitos por semana">
          <Colunas serie={habitosPorSemana} cor="bg-sapo/55" corDoDestaque="bg-sapo" />
        </Quadro>
      ) : (
        <p className={VAZIO}>{SEM_HABITOS}</p>
      )}
    </div>
  );
}
