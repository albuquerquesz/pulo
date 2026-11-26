import { useId, type ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { CARTAO } from './estilos';
import type { Coluna, Serie, SeriesDoRitmo } from './series';

/** Altura fixa da área do gráfico, igual nos dois cartões. */
const ALTURA = 200;
const EIXO = { fontSize: 11, fill: 'var(--pulo-muted)' } as const;

/** A dica ao passar o mouse: o nome da coluna e o valor já formatado. */
function Dica({ active, payload }: { active?: boolean; payload?: readonly { payload: Coluna }[] }) {
  const coluna = payload?.[0]?.payload;
  if (!active || !coluna) return null;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-1.5 text-[13px] shadow-sm">
      <span className="block text-muted first-letter:uppercase">{coluna.nome}</span>
      <b>{coluna.texto}</b>
    </div>
  );
}

type CartaoProps = { titulo: string; legenda: string; serie: Serie; children: ReactNode };

/** Um cartão com o título, o gráfico (fora do leitor de tela) e a tabela com os mesmos números para quem não vê. */
function CartaoDoGrafico({ titulo, legenda, serie, children }: CartaoProps) {
  const id = useId();
  return (
    <figure aria-labelledby={id} className={`${CARTAO} relative flex min-w-0 flex-col gap-3 p-5`}>
      <figcaption className="flex flex-col">
        <b id={id} className="text-base font-extrabold">
          {titulo}
        </b>
        <span className="text-xs text-muted">{legenda}</span>
      </figcaption>
      <div aria-hidden="true" className="relative" style={{ height: ALTURA }}>
        {children}
      </div>
      <div className="sr-only">
        <table>
          <tbody>
            {serie.colunas.map((coluna) => (
              <tr key={coluna.chave}>
                <th scope="row">{coluna.nome}</th>
                <td>{coluna.texto}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

type PontoDaArea = { cx?: number; cy?: number; payload?: Coluna; index?: number };

/** Só o dia de hoje ganha bolinha na linha. */
function PontoDeHoje({ cx, cy, payload, index }: PontoDaArea) {
  if (!payload?.destaque || cx === undefined || cy === undefined) return <g key={index} />;
  return <circle key={index} cx={cx} cy={cy} r={5} fill="var(--pulo-foco)" stroke="var(--pulo-surface)" strokeWidth={2} />;
}

/** Minutos de foco por dia, em área, com o dia de hoje marcado. */
function GraficoDeFoco({ serie }: { serie: Serie }) {
  const gradiente = `foco${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const topo = Math.max(10, ...serie.colunas.map((c) => c.valor));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={serie.colunas} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id={gradiente} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--pulo-foco)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="var(--pulo-foco)" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--pulo-line)" />
        <XAxis dataKey="rotulo" tick={EIXO} tickLine={false} axisLine={false} interval={0} />
        <YAxis domain={[0, topo]} tick={EIXO} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(m: number) => `${m}m`} />
        <Tooltip content={<Dica />} cursor={{ stroke: 'var(--pulo-line)' }} />
        <Area
          type="monotone"
          dataKey="valor"
          stroke="var(--pulo-foco)"
          strokeWidth={3}
          fill={`url(#${gradiente})`}
          dot={PontoDeHoje}
          activeDot={{ r: 5, fill: 'var(--pulo-foco)', stroke: 'var(--pulo-surface)', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** A taxa de hábitos feitos por semana, em barras arredondadas, com a semana atual mais forte. */
function GraficoDeHabitos({ serie }: { serie: Serie }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={serie.colunas} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke="var(--pulo-line)" />
        <XAxis dataKey="rotulo" tick={EIXO} tickLine={false} axisLine={false} interval={0} />
        <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={EIXO} tickLine={false} axisLine={false} tickFormatter={(p: number) => `${p}%`} />
        <Tooltip content={<Dica />} cursor={{ fill: 'var(--pulo-line)', opacity: 0.4 }} />
        <Bar dataKey="valor" radius={[8, 8, 4, 4]} maxBarSize={48} isAnimationActive={false}>
          {serie.colunas.map((coluna) => (
            <Cell key={coluna.chave} fill={coluna.destaque ? 'var(--pulo-sapo)' : 'color-mix(in srgb, var(--pulo-sapo) 50%, transparent)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

type GraficosProps = { series: SeriesDoRitmo; dias: number };

/** Os dois gráficos do Ritmo, cada um no seu cartão, meio a meio no desktop. */
export function GraficosDoRitmo({ series: { porDia, habitosPorSemana }, dias }: GraficosProps) {
  return (
    <div className="grid gap-4 @2xl:grid-cols-2">
      <CartaoDoGrafico titulo="Foco por dia" legenda={`Minutos de foco nos últimos ${dias} dias`} serie={porDia}>
        <GraficoDeFoco serie={porDia} />
      </CartaoDoGrafico>
      <CartaoDoGrafico titulo="Hábitos feitos por semana" legenda="Quanto dos hábitos do dia você marcou" serie={habitosPorSemana}>
        <GraficoDeHabitos serie={habitosPorSemana} />
      </CartaoDoGrafico>
    </div>
  );
}

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
