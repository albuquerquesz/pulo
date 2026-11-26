import { DAY_ROLLOVER_HOUR, DEFAULT_TIMEZONE, METRICAS } from '@pulo/core/config/decisions';
import { MINUTE_MS } from '@pulo/core/domain/clock';
import { addDays, dateKeyOf, diffDays, weekdayOf, weekStartOf } from '@pulo/core/domain/day';
import { focusedMs } from '@pulo/core/domain/joias';
import { streakDaySets } from '@pulo/core/domain/streak';
import type { Clock, DateKey, FocusSession, Habit, HabitLog, Repository, RestDay, User, Vacation } from '@pulo/core/domain/types';

import { verPreferencias } from '../app/conta';
import { duracaoTexto } from '../hoje/logic';
import { porcentagem } from './metricas';

/** Uma coluna de um gráfico, já pronta para a tela. */
export interface Coluna {
  chave: string;
  /** O nome no eixo; vazio quando a coluna fica sem rótulo. */
  rotulo: string;
  /** Para o leitor de tela. */
  nome: string;
  texto: string;
  /** De 0 a 100, em relação ao topo do eixo. */
  altura: number;
  destaque: boolean;
}

export interface Serie {
  colunas: Coluna[];
  /** Os textos do eixo, do topo à base. */
  eixo: string[];
}

/** Os dois gráficos do Ritmo. Sem registros, as séries vêm zeradas (o gráfico aparece vazio). */
export interface SeriesDoRitmo {
  porDia: Serie;
  habitosPorSemana: Serie;
}

export interface RegistrosDoRitmo {
  sessions: readonly FocusSession[];
  habits: readonly Habit[];
  habitLogs: readonly HabitLog[];
  restDays: readonly RestDay[];
  vacation?: Vacation;
  user: Pick<User, 'createdAt' | 'timezone' | 'dayStartMinutes'>;
  now: number;
}

interface SessaoDaJanela {
  date: DateKey;
  ms: number;
}

interface DiaDeHabitos {
  date: DateKey;
  esperados: number;
  feitos: number;
}

/** Topos "redondos" do eixo de minutos; a metade de cada um também é redonda. */
const TOPOS = [10, 20, 30, 60, 90, 120, 180, 240, 360, 480, 600];
const MAIOR_PASSO = 240;

const diaEMes = (date: DateKey): string => `${date.slice(8)}/${date.slice(5, 7)}`;
const minutosDe = (sessoes: readonly SessaoDaJanela[]): number => Math.floor(sessoes.reduce((total, s) => total + s.ms, 0) / MINUTE_MS);
const topoDoEixo = (maior: number): number => TOPOS.find((topo) => topo >= maior) ?? Math.ceil(maior / MAIOR_PASSO) * MAIOR_PASSO;
const alturaDe = (valor: number, topo: number): number => Math.round((valor / topo) * 100);
const eixoDeMinutos = (topo: number): string[] => [duracaoTexto(topo), duracaoTexto(topo / 2), '0'];

function focoPorDia(sessoes: readonly SessaoDaJanela[], dias: readonly DateKey[]): Serie {
  const minutos = dias.map((dia) => minutosDe(sessoes.filter((s) => s.date === dia)));
  const topo = topoDoEixo(Math.max(...minutos));
  const colunas = dias.map((date, i): Coluna => {
    const distancia = dias.length - 1 - i;
    const hoje = distancia === 0;
    const marcado = distancia % 7 === 0 ? diaEMes(date) : '';
    const doDia = minutos[i] ?? 0;
    return {
      chave: date,
      rotulo: hoje ? 'hoje' : marcado,
      nome: hoje ? `${diaEMes(date)} (hoje)` : diaEMes(date),
      texto: duracaoTexto(doDia),
      altura: alturaDe(doDia, topo),
      destaque: hoje,
    };
  });
  return { colunas, eixo: eixoDeMinutos(topo) };
}

/** A mesma regra da taxa das métricas: só hábitos ativos, desde o primeiro registro; descanso, férias e hoje só contam se feitos. */
function diasDeHabitos(registros: RegistrosDoRitmo, dias: readonly DateKey[], hoje: DateKey, parados: ReadonlySet<DateKey>): DiaDeHabitos[] {
  const habitos = registros.habits
    .filter((h) => h.state === 'ativo')
    .map((h) => {
      const feitos = new Set(registros.habitLogs.filter((log) => log.habitId === h.id).map((log) => log.date));
      const [inicio] = [...feitos].sort();
      return { weekdays: h.weekdays, feitos, inicio };
    });
  return dias.map((date) => {
    const doDia = habitos.filter(
      (h) => h.inicio !== undefined && date >= h.inicio && h.weekdays.includes(weekdayOf(date)) && (h.feitos.has(date) || (date !== hoje && !parados.has(date))),
    );
    return { date, esperados: doDia.length, feitos: doDia.filter((h) => h.feitos.has(date)).length };
  });
}

function habitosPorSemana(dias: readonly DiaDeHabitos[]): Serie {
  const semanas = [...new Set(dias.map((d) => weekStartOf(d.date)))];
  const colunas = semanas.map((semana, i): Coluna => {
    const daSemana = dias.filter((d) => weekStartOf(d.date) === semana);
    const esperados = daSemana.reduce((total, d) => total + d.esperados, 0);
    const taxa = esperados === 0 ? null : daSemana.reduce((total, d) => total + d.feitos, 0) / esperados;
    // A primeira semana pode começar no meio: o rótulo é o primeiro dia que entra na conta.
    const inicio = daSemana[0]?.date ?? semana;
    return {
      chave: semana,
      rotulo: diaEMes(inicio),
      nome: `semana de ${diaEMes(inicio)}`,
      texto: taxa === null ? 'sem hábitos na conta' : porcentagem(taxa),
      altura: Math.round((taxa ?? 0) * 100),
      destaque: i === semanas.length - 1,
    };
  });
  return { colunas, eixo: ['100%', '50%', '0'] };
}

/** As séries dos últimos `METRICAS.janelaDias` dias lógicos, nunca antes de a conta existir (como as métricas). */
export function seriesDoRitmo(registros: RegistrosDoRitmo): SeriesDoRitmo {
  const { sessions, user } = registros;
  const fuso = user.timezone || DEFAULT_TIMEZONE;
  const virada = user.dayStartMinutes ?? DAY_ROLLOVER_HOUR * 60;
  const { today, rest, vacation } = streakDaySets({ ...registros, timeZone: fuso, dayStartMinutes: virada });
  const criada = dateKeyOf(user.createdAt, fuso, virada);
  const comecoDaJanela = addDays(today, 1 - METRICAS.janelaDias);
  const primeiro = criada > comecoDaJanela ? criada : comecoDaJanela;
  const total = Math.max(1, diffDays(today, primeiro) + 1);
  const dias = Array.from({ length: total }, (_, i) => addDays(today, i - total + 1));
  const daJanela = new Set(dias);
  const sessoes = sessions
    .filter((s) => s.state !== 'em_andamento')
    .map((s): SessaoDaJanela => ({ date: dateKeyOf(s.endedAt ?? s.startedAt, fuso, virada), ms: focusedMs(s) }))
    .filter((s) => daJanela.has(s.date));
  return {
    porDia: focoPorDia(sessoes, dias),
    habitosPorSemana: habitosPorSemana(diasDeHabitos(registros, dias, today, new Set([...rest, ...vacation]))),
  };
}

export async function carregarSeries(repo: Repository, clock: Clock): Promise<SeriesDoRitmo> {
  const [user, sessions, habits, habitLogs, restDays, preferencias] = await Promise.all([
    repo.getUser(),
    repo.listSessions(),
    repo.listHabits(),
    repo.listHabitLogs(),
    repo.listRestDays(),
    verPreferencias(repo),
  ]);
  if (!user) throw new Error('sem usuário');
  return seriesDoRitmo({ user, sessions, habits, habitLogs, restDays, vacation: preferencias?.vacation, now: clock.now() });
}
