import { DAY_ROLLOVER_HOUR, DEFAULT_TIMEZONE, JOIAS, METRICAS } from '@pulo/core/config/decisions';
import { MINUTE_MS } from '@pulo/core/domain/clock';
import { addDays, dateKeyOf, diffDays, periodOf, weekdayOf, weekStartOf } from '@pulo/core/domain/day';
import { providesFreezeStore } from '@pulo/core/domain/gelo-store';
import { focusedMs, joiasDoFoco } from '@pulo/core/domain/joias';
import { streakDaySets } from '@pulo/core/domain/streak';
import { bestPeriod } from '@pulo/core/domain/week-summary';
import type {
  Clock,
  DateKey,
  FocusSession,
  FreezeUse,
  Goal,
  GoalChest,
  Habit,
  HabitLog,
  Period,
  Repository,
  RestDay,
  Task,
  User,
  Vacation,
} from '@pulo/core/domain/types';

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
  /** O valor bruto: minutos de foco ou porcentagem de hábitos (0 a 100). */
  valor: number;
  destaque: boolean;
}

export interface Serie {
  colunas: Coluna[];
  /** Os textos do eixo, do topo à base. */
  eixo: string[];
}

/** Os intervalos que cada cartão do Ritmo deixa escolher. */
export const INTERVALOS = [
  { dias: 1, rotulo: 'Hoje' },
  { dias: 7, rotulo: '7 dias' },
  { dias: 30, rotulo: '30 dias' },
] as const;
export type Intervalo = (typeof INTERVALOS)[number]['dias'];

/** O cartão do foco: o gráfico por dia e os números do intervalo. Sem registros, tudo vem zerado. */
export interface FocoDoIntervalo {
  porDia: Serie;
  /** Minutos por dia, na média do intervalo. */
  medioPorDia: number;
  sessoesTerminadas: number;
  melhorPeriodo: Period | null;
}

/** O cartão dos hábitos: por dia até uma semana, por semana acima disso, e a taxa do intervalo (`null` sem hábito que conte). */
export interface HabitosDoIntervalo {
  serie: Serie;
  taxa: number | null;
}

export interface RegistrosDoRitmo {
  sessions: readonly FocusSession[];
  habits: readonly Habit[];
  habitLogs: readonly HabitLog[];
  restDays: readonly RestDay[];
  freezeUses: readonly FreezeUse[];
  tasks: readonly Task[];
  goals: readonly Goal[];
  baus: readonly GoalChest[];
  vacation?: Vacation;
  user: Pick<User, 'createdAt' | 'timezone' | 'dayStartMinutes'>;
  now: number;
}

interface SessaoDaJanela {
  date: DateKey;
  ms: number;
  periodo: Period;
  concluida: boolean;
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
    const marcado = dias.length <= 7 || distancia % 7 === 0 ? diaEMes(date) : '';
    const doDia = minutos[i] ?? 0;
    return {
      chave: date,
      rotulo: hoje ? 'hoje' : marcado,
      nome: hoje ? `${diaEMes(date)} (hoje)` : diaEMes(date),
      texto: duracaoTexto(doDia),
      altura: alturaDe(doDia, topo),
      valor: doDia,
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

function habitosPorDia(dias: readonly DiaDeHabitos[]): Serie {
  const colunas = dias.map((d, i): Coluna => {
    const taxa = d.esperados === 0 ? null : d.feitos / d.esperados;
    const hoje = i === dias.length - 1;
    return {
      chave: d.date,
      rotulo: hoje ? 'hoje' : diaEMes(d.date),
      nome: hoje ? `${diaEMes(d.date)} (hoje)` : diaEMes(d.date),
      texto: taxa === null ? 'sem hábitos no dia' : porcentagem(taxa),
      altura: Math.round((taxa ?? 0) * 100),
      valor: Math.round((taxa ?? 0) * 100),
      destaque: hoje,
    };
  });
  return { colunas, eixo: ['100%', '50%', '0'] };
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
      valor: Math.round((taxa ?? 0) * 100),
      destaque: i === semanas.length - 1,
    };
  });
  return { colunas, eixo: ['100%', '50%', '0'] };
}

/** Os dias lógicos do intervalo, até hoje, nunca antes de a conta existir (como as métricas). */
function contexto(registros: RegistrosDoRitmo, intervalo: number) {
  const { user } = registros;
  const fuso = user.timezone || DEFAULT_TIMEZONE;
  const virada = user.dayStartMinutes ?? DAY_ROLLOVER_HOUR * 60;
  const { today, rest, vacation } = streakDaySets({ ...registros, timeZone: fuso, dayStartMinutes: virada });
  const criada = dateKeyOf(user.createdAt, fuso, virada);
  const comecoDaJanela = addDays(today, 1 - intervalo);
  const primeiro = criada > comecoDaJanela ? criada : comecoDaJanela;
  const total = Math.max(1, diffDays(today, primeiro) + 1);
  const dias = Array.from({ length: total }, (_, i) => addDays(today, i - total + 1));
  return { fuso, virada, today, parados: new Set([...rest, ...vacation]), dias };
}

/** O foco do intervalo: minutos por dia, a média, as sessões terminadas e o melhor período (a mesma regra das métricas). */
export function focoDoIntervalo(registros: RegistrosDoRitmo, intervalo: number = METRICAS.janelaDias): FocoDoIntervalo {
  const { fuso, virada, dias } = contexto(registros, intervalo);
  const daJanela = new Set(dias);
  const sessoes = registros.sessions
    .filter((s) => s.state !== 'em_andamento')
    .map(
      (s): SessaoDaJanela => ({
        date: dateKeyOf(s.endedAt ?? s.startedAt, fuso, virada),
        ms: focusedMs(s),
        periodo: periodOf(s.startedAt, fuso),
        concluida: s.state === 'concluida',
      }),
    )
    .filter((s) => daJanela.has(s.date));
  const doPeriodo = (periodo: Period) => sessoes.filter((s) => s.periodo === periodo);
  const msDe = (periodo: Period) => doPeriodo(periodo).reduce((total, s) => total + s.ms, 0);
  const concluidasDe = (periodo: Period) => ({ completed: doPeriodo(periodo).filter((s) => s.concluida).length });
  const ms: Record<Period, number> = { manha: msDe('manha'), tarde: msDe('tarde'), noite: msDe('noite') };
  const concluidas: Record<Period, { completed: number }> = { manha: concluidasDe('manha'), tarde: concluidasDe('tarde'), noite: concluidasDe('noite') };
  return {
    porDia: focoPorDia(sessoes, dias),
    medioPorDia: Math.round(minutosDe(sessoes) / dias.length),
    sessoesTerminadas: sessoes.filter((s) => s.concluida).length,
    melhorPeriodo: bestPeriod(ms, concluidas),
  };
}

/** Os hábitos do intervalo: por dia até uma semana, por semana acima disso, e a taxa somando o intervalo todo. */
export function habitosDoIntervalo(registros: RegistrosDoRitmo, intervalo: number = METRICAS.janelaDias): HabitosDoIntervalo {
  const { today, parados, dias } = contexto(registros, intervalo);
  const doIntervalo = diasDeHabitos(registros, dias, today, parados);
  const esperados = doIntervalo.reduce((total, d) => total + d.esperados, 0);
  return {
    serie: dias.length <= 7 ? habitosPorDia(doIntervalo) : habitosPorSemana(doIntervalo),
    taxa: esperados === 0 ? null : doIntervalo.reduce((total, d) => total + d.feitos, 0) / esperados,
  };
}

/** Uma coluna com duas contagens empilhadas no mesmo dia ou semana (descanso e gelo, tarefas e metas). */
export interface ColunaEmPilha {
  chave: string;
  rotulo: string;
  /** Para o leitor de tela. */
  nome: string;
  texto: string;
  a: number;
  b: number;
  destaque: boolean;
}

const plural = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`;

/** Quantas vezes cada dia aparece. */
function contagemPorDia(entradas: readonly { date: DateKey; quanto: number }[]): Map<DateKey, number> {
  const contagem = new Map<DateKey, number>();
  for (const { date, quanto } of entradas) contagem.set(date, (contagem.get(date) ?? 0) + quanto);
  return contagem;
}

const somaNosDias = (contagem: ReadonlyMap<DateKey, number>, dias: readonly DateKey[]): number => dias.reduce((total, d) => total + (contagem.get(d) ?? 0), 0);

/** As colunas empilhadas: por dia até uma semana, por semana acima disso (como o cartão dos hábitos). */
function emPilha(dias: readonly DateKey[], a: ReadonlyMap<DateKey, number>, b: ReadonlyMap<DateKey, number>, descrever: (a: number, b: number) => string): ColunaEmPilha[] {
  if (dias.length <= 7) {
    return dias.map((date, i): ColunaEmPilha => {
      const hoje = i === dias.length - 1;
      const [doA, doB] = [a.get(date) ?? 0, b.get(date) ?? 0];
      return { chave: date, rotulo: hoje ? 'hoje' : diaEMes(date), nome: hoje ? `${diaEMes(date)} (hoje)` : diaEMes(date), texto: descrever(doA, doB), a: doA, b: doB, destaque: hoje };
    });
  }
  const semanas = [...new Set(dias.map((d) => weekStartOf(d)))];
  return semanas.map((semana, i): ColunaEmPilha => {
    const daSemana = dias.filter((d) => weekStartOf(d) === semana);
    const [doA, doB] = [somaNosDias(a, daSemana), somaNosDias(b, daSemana)];
    const inicio = daSemana[0] ?? semana;
    return { chave: semana, rotulo: diaEMes(inicio), nome: `semana de ${diaEMes(inicio)}`, texto: descrever(doA, doB), a: doA, b: doB, destaque: i === semanas.length - 1 };
  });
}

/** O cartão do descanso: descansos e gelos usados no intervalo, empilhados por dia ou semana. */
export interface DescansoDoIntervalo {
  colunas: ColunaEmPilha[];
  descansos: number;
  gelos: number;
}

export function descansoDoIntervalo(registros: RegistrosDoRitmo, intervalo: number = METRICAS.janelaDias): DescansoDoIntervalo {
  const { dias } = contexto(registros, intervalo);
  const descansos = contagemPorDia(registros.restDays.map((r) => ({ date: r.date, quanto: 1 })));
  const gelos = contagemPorDia(registros.freezeUses.map((u) => ({ date: u.date, quanto: 1 })));
  return {
    colunas: emPilha(dias, descansos, gelos, (a, b) => `${plural(a, 'descanso', 'descansos')}, ${plural(b, 'gelo', 'gelos')}`),
    descansos: somaNosDias(descansos, dias),
    gelos: somaNosDias(gelos, dias),
  };
}

/** O cartão do concluído: tarefas e metas empilhadas por dia ou semana, e as joias ganhas no intervalo. */
export interface ConcluidoDoIntervalo {
  colunas: ColunaEmPilha[];
  tarefas: number;
  metas: number;
  joias: number;
}

export function concluidoDoIntervalo(registros: RegistrosDoRitmo, intervalo: number = METRICAS.janelaDias): ConcluidoDoIntervalo {
  const { fuso, virada, dias } = contexto(registros, intervalo);
  const dia = (ts: number): DateKey => dateKeyOf(ts, fuso, virada);
  const tarefas = contagemPorDia(registros.tasks.flatMap((t) => (t.status === 'feito' && t.completedAt !== undefined ? [{ date: dia(t.completedAt), quanto: 1 }] : [])));
  const metas = contagemPorDia(registros.goals.flatMap((g) => (g.state === 'concluida' && g.completedAt !== undefined ? [{ date: dia(g.completedAt), quanto: 1 }] : [])));
  // As mesmas fontes de joias do saldo, cada uma no dia em que rendeu.
  const por = JOIAS.por;
  const joias = contagemPorDia([
    ...registros.habitLogs.map((log) => ({ date: log.date, quanto: por.habitDone })),
    ...registros.sessions.filter((s) => s.state !== 'em_andamento').map((s) => ({ date: dia(s.endedAt ?? s.startedAt), quanto: joiasDoFoco(s) })),
    ...registros.restDays.map((r) => ({ date: r.date, quanto: por.restDay })),
    ...registros.goals.flatMap((g) => g.milestones.flatMap((m) => (m.doneAt === undefined ? [] : [{ date: dia(m.doneAt), quanto: por.milestoneDone }]))),
    ...registros.baus.map((b) => ({ date: dia(b.abertoEm), quanto: b.joias })),
  ]);
  return {
    colunas: emPilha(dias, tarefas, metas, (a, b) => `${plural(a, 'tarefa', 'tarefas')}, ${plural(b, 'meta', 'metas')}`),
    tarefas: somaNosDias(tarefas, dias),
    metas: somaNosDias(metas, dias),
    joias: somaNosDias(joias, dias),
  };
}

/** Os registros que os cartões do Ritmo usam; cada cartão calcula o próprio intervalo. */
export async function carregarRegistros(repo: Repository, clock: Clock): Promise<RegistrosDoRitmo> {
  const [user, sessions, habits, habitLogs, restDays, freezeUses, tasks, goals, baus, preferencias] = await Promise.all([
    repo.getUser(),
    repo.listSessions(),
    repo.listHabits(),
    repo.listHabitLogs(),
    repo.listRestDays(),
    providesFreezeStore(repo) ? repo.listFreezeUses() : [],
    repo.listTasks(),
    repo.listGoals(),
    repo.listGoalChests(),
    verPreferencias(repo),
  ]);
  if (!user) throw new Error('sem usuário');
  return { user, sessions, habits, habitLogs, restDays, freezeUses, tasks, goals, baus, vacation: preferencias?.vacation, now: clock.now() };
}
