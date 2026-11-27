import { useId, useMemo, useState, type ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { CARTAO } from './estilos';
import { duracaoTexto } from '../hoje/logic';
import { Escolha } from './Linha';
import { numero } from './logic';
import { porcentagem } from './metricas';
import {
  concluidoDoIntervalo,
  descansoDoIntervalo,
  focoDoIntervalo,
  habitosDoIntervalo,
  INTERVALOS,
  type Coluna,
  type ColunaEmPilha,
  type Intervalo,
  type RegistrosDoRitmo,
} from './series';

/** Altura fixa da área do gráfico, igual nos dois cartões. */
const ALTURA = 200;
const EIXO = { fontSize: 11, fill: 'var(--pulo-muted)' } as const;

/** O que a dica e a tabela do leitor de tela mostram de cada coluna. */
type LinhaDoGrafico = Pick<Coluna, 'chave' | 'nome' | 'texto'>;

/** A dica ao passar o mouse: o nome da coluna e o valor já formatado. */
function Dica({ active, payload }: { active?: boolean; payload?: readonly { payload: LinhaDoGrafico }[] }) {
  const coluna = payload?.[0]?.payload;
  if (!active || !coluna) return null;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-1.5 text-[13px] shadow-sm">
      <span className="block text-muted first-letter:uppercase">{coluna.nome}</span>
      <b>{coluna.texto}</b>
    </div>
  );
}

/** Um número que aparece no topo do cartão do gráfico. */
export type NumeroDoGrafico = { legenda: string; valor: string };

type CartaoProps = {
  titulo: string;
  numeros: readonly NumeroDoGrafico[];
  intervalo: Intervalo;
  onIntervalo: (intervalo: Intervalo) => void;
  linhas: readonly LinhaDoGrafico[];
  children: ReactNode;
};

const OPCOES_DE_INTERVALO = INTERVALOS.map((i) => ({ valor: String(i.dias), rotulo: i.rotulo }));
const intervaloDe = (valor: string): Intervalo => INTERVALOS.find((i) => String(i.dias) === valor)?.dias ?? 30;

/** Um cartão com os números no topo e o gráfico embaixo; o título fica para o leitor de tela, junto da tabela com os mesmos números. */
function CartaoDoGrafico({ titulo, numeros, intervalo, onIntervalo, linhas, children }: CartaoProps) {
  return (
    <figure aria-label={titulo} className={`${CARTAO} relative flex min-w-0 flex-col gap-4 p-5`}>
      <div className="flex items-start justify-between gap-4">
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          {numeros.map((n) => (
            <div key={n.legenda} className="flex min-w-0 flex-col">
              <dt className="text-[11px] font-extrabold tracking-[0.06em] text-muted uppercase">{n.legenda}</dt>
              <dd className="text-[28px] leading-tight font-extrabold">{n.valor}</dd>
            </div>
          ))}
        </dl>
        <Escolha rotulo={`Intervalo de ${titulo.toLowerCase()}`} valor={String(intervalo)} opcoes={OPCOES_DE_INTERVALO} onEscolher={(v) => onIntervalo(intervaloDe(v))} />
      </div>
      <div aria-hidden="true" className="relative" style={{ height: ALTURA }}>
        {children}
      </div>
      <div className="sr-only">
        <table>
          <tbody>
            {linhas.map((coluna) => (
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
function GraficoDeFoco({ serie }: { serie: { colunas: Coluna[] } }) {
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
function GraficoDeHabitos({ serie }: { serie: { colunas: Coluna[] } }) {
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

/** O cartão do foco: média por dia, sessões e melhor período em cima, e a área dos minutos por dia. */
function CartaoDoFoco({ registros }: { registros: RegistrosDoRitmo }) {
  const [intervalo, setIntervalo] = useState<Intervalo>(30);
  const foco = useMemo(() => focoDoIntervalo(registros, intervalo), [registros, intervalo]);
  const numeros = [
    { legenda: 'Foco médio', valor: duracaoTexto(foco.medioPorDia) },
    { legenda: 'Sessões terminadas', valor: numero(foco.sessoesTerminadas) },
  ];
  return (
    <CartaoDoGrafico titulo="Foco por dia" numeros={numeros} intervalo={intervalo} onIntervalo={setIntervalo} linhas={foco.porDia.colunas}>
      <GraficoDeFoco serie={foco.porDia} />
    </CartaoDoGrafico>
  );
}

/** O cartão dos hábitos: a taxa do intervalo em cima e as barras por dia ou por semana. */
function CartaoDosHabitos({ registros }: { registros: RegistrosDoRitmo }) {
  const [intervalo, setIntervalo] = useState<Intervalo>(30);
  const habitos = useMemo(() => habitosDoIntervalo(registros, intervalo), [registros, intervalo]);
  return (
    <CartaoDoGrafico
      titulo="Hábitos feitos"
      numeros={[{ legenda: 'Hábitos feitos', valor: porcentagem(habitos.taxa) }]}
      intervalo={intervalo}
      onIntervalo={setIntervalo}
      linhas={habitos.serie.colunas}
    >
      <GraficoDeHabitos serie={habitos.serie} />
    </CartaoDoGrafico>
  );
}

/** Os dois cartões do Ritmo, meio a meio no desktop; cada um escolhe o próprio intervalo. */
export function GraficosDoRitmo({ registros }: { registros: RegistrosDoRitmo }) {
  return (
    <div className="grid gap-4 @2xl:grid-cols-2">
      <CartaoDoFoco registros={registros} />
      <CartaoDosHabitos registros={registros} />
    </div>
  );
}

type Pilha = { rotulo: string; cor: string };

/** Duas contagens empilhadas por dia ou semana; a coluna de hoje (ou da semana atual) fica inteira, as outras mais claras. */
function GraficoEmPilha({ colunas, a, b }: { colunas: ColunaEmPilha[]; a: Pilha; b: Pilha }) {
  const topo = Math.max(2, ...colunas.map((c) => c.a + c.b));
  const tom = (cor: string, destaque: boolean) => (destaque ? cor : `color-mix(in srgb, ${cor} 50%, transparent)`);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={colunas} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke="var(--pulo-line)" />
        <XAxis dataKey="rotulo" tick={EIXO} tickLine={false} axisLine={false} interval={0} />
        <YAxis domain={[0, topo]} tick={EIXO} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip content={<Dica />} cursor={{ fill: 'var(--pulo-line)', opacity: 0.4 }} />
        <Bar dataKey="a" name={a.rotulo} stackId="pilha" maxBarSize={48} isAnimationActive={false}>
          {colunas.map((coluna) => (
            <Cell key={coluna.chave} fill={tom(a.cor, coluna.destaque)} />
          ))}
        </Bar>
        <Bar dataKey="b" name={b.rotulo} stackId="pilha" radius={[8, 8, 0, 0]} maxBarSize={48} isAnimationActive={false}>
          {colunas.map((coluna) => (
            <Cell key={coluna.chave} fill={tom(b.cor, coluna.destaque)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** O cartão do descanso: descansos e gelos usados no intervalo, e os gelos guardados agora. */
function CartaoDoDescanso({ registros, guardados }: { registros: RegistrosDoRitmo; guardados: number }) {
  const [intervalo, setIntervalo] = useState<Intervalo>(30);
  const descanso = useMemo(() => descansoDoIntervalo(registros, intervalo), [registros, intervalo]);
  const numeros = [
    { legenda: 'Descansos', valor: numero(descanso.descansos) },
    { legenda: 'Gelos usados', valor: numero(descanso.gelos) },
    { legenda: 'Gelos guardados', valor: numero(guardados) },
  ];
  return (
    <CartaoDoGrafico titulo="Descanso e gelo" numeros={numeros} intervalo={intervalo} onIntervalo={setIntervalo} linhas={descanso.colunas}>
      <GraficoEmPilha colunas={descanso.colunas} a={{ rotulo: 'Descansos', cor: 'var(--pulo-descanso)' }} b={{ rotulo: 'Gelos', cor: 'var(--pulo-agua)' }} />
    </CartaoDoGrafico>
  );
}

/** O cartão do concluído: tarefas e metas empilhadas, e as joias ganhas no intervalo. */
function CartaoDoConcluido({ registros }: { registros: RegistrosDoRitmo }) {
  const [intervalo, setIntervalo] = useState<Intervalo>(30);
  const concluido = useMemo(() => concluidoDoIntervalo(registros, intervalo), [registros, intervalo]);
  const numeros = [
    { legenda: 'Tarefas', valor: numero(concluido.tarefas) },
    { legenda: 'Metas', valor: numero(concluido.metas) },
    { legenda: 'Joias', valor: numero(concluido.joias) },
  ];
  return (
    <CartaoDoGrafico titulo="Concluído" numeros={numeros} intervalo={intervalo} onIntervalo={setIntervalo} linhas={concluido.colunas}>
      <GraficoEmPilha colunas={concluido.colunas} a={{ rotulo: 'Tarefas', cor: 'var(--pulo-agua)' }} b={{ rotulo: 'Metas', cor: 'var(--pulo-joia)' }} />
    </CartaoDoGrafico>
  );
}

/** Descanso e concluído, meio a meio no desktop, no mesmo molde dos cartões do Ritmo. */
export function GraficosDoDescanso({ registros, guardados }: { registros: RegistrosDoRitmo; guardados: number }) {
  return (
    <div className="grid gap-4 @2xl:grid-cols-2">
      <CartaoDoDescanso registros={registros} guardados={guardados} />
      <CartaoDoConcluido registros={registros} />
    </div>
  );
}
