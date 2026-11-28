import { DEFAULT_TIMEZONE, GOALS } from '@pulo/core/config/decisions';
import { dateKeyOf, diffDays, weekDates, weekStartOf } from '@pulo/core/domain/day';
import { sortGoals, type GoalPace, type PaceState } from '@pulo/core/domain/goals';
import type { Clock, DateKey, EntityId, FocusSession, Goal, GoalChest, Habit, HabitLog, Repository, User } from '@pulo/core/domain/types';

export interface DadosMetas {
  hoje: DateKey;
  /** Prazo mais perto antes. */
  ativas: Goal[];
  /** A concluída mais recente antes. */
  concluidas: Goal[];
  /** Ainda cabe uma meta ativa nova. */
  cabeMais: boolean;
  baus: GoalChest[];
  habitos: Habit[];
  registros: HabitLog[];
  sessoes: FocusSession[];
}

export async function carregarMetas(repo: Repository, clock: Clock, user: User): Promise<DadosMetas> {
  const [todas, baus, habitos, registros, sessoes] = await Promise.all([
    repo.listGoals(),
    repo.listGoalChests(),
    repo.listHabits(),
    repo.listHabitLogs(),
    repo.listSessions(),
  ]);
  const metas = sortGoals(todas);
  const ativas = metas.filter((m) => m.state === 'ativa');
  return {
    hoje: dateKeyOf(clock.now(), user.timezone || DEFAULT_TIMEZONE),
    ativas,
    concluidas: metas.filter((m) => m.state === 'concluida'),
    cabeMais: ativas.length < GOALS.maxActive,
    baus,
    habitos,
    registros,
    sessoes,
  };
}

/** Segunda a domingo da semana de hoje: se o hábito foi feito em cada dia. */
export function semanaDoHabito(habitoId: EntityId, registros: readonly HabitLog[], hoje: DateKey): boolean[] {
  const feitos = new Set(registros.filter((r) => r.habitId === habitoId).map((r) => r.date));
  return weekDates(weekStartOf(hoje)).map((dia) => feitos.has(dia));
}

/** Os hábitos que dá para atrelar: os sem meta que não estão arquivados. */
export function habitosSoltos(habitos: readonly Habit[]): Habit[] {
  return habitos.filter((h) => !h.goalId && h.state !== 'arquivado');
}

/** Onde a linha de ritmo fica na barra, em porcentagem. Sem data alvo ou concluída, não há linha. */
export function posicaoDoRitmo(pace: GoalPace): number | undefined {
  if (pace.estado === 'concluida' || pace.estado === 'sem-data') return undefined;
  return Math.round(pace.esperado * 100);
}

export interface Selo {
  texto: string;
  tom: 'bom' | 'atras';
}

const SELOS: Record<PaceState, Selo | null> = {
  'no-ritmo': { texto: 'No ritmo', tom: 'bom' },
  atras: { texto: 'Um pouco atrás', tom: 'atras' },
  concluida: { texto: 'Concluída', tom: 'bom' },
  'sem-data': null,
};

export const seloDoRitmo = (estado: PaceState): Selo | null => SELOS[estado];

const DIA_E_MES = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const DIA_MES_E_ANO = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const DIA_E_MES_CURTO = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const DIAS_DO_ANO = 365;

const comoData = (key: DateKey) => new Date(`${key}T00:00:00Z`);

/** "30 de junho". O ano só entra quando a data está a um ano ou mais de hoje. */
function dataPorExtenso(key: DateKey, hoje: DateKey): string {
  const longe = Math.abs(diffDays(key, hoje)) >= DIAS_DO_ANO;
  return (longe ? DIA_MES_E_ANO : DIA_E_MES).format(comoData(key));
}

/** "12 set". */
export function dataCurta(instante: number, timeZone: string): string {
  return DIA_E_MES_CURTO.format(comoData(dateKeyOf(instante, timeZone))).replace(' de ', ' ').replace('.', '');
}

/** A etiqueta de data do cabeçalho: o prazo, ou quando foi concluída. */
export function textoDaData(meta: Goal, hoje: DateKey, timeZone: string): string {
  if (meta.state === 'concluida') {
    return meta.completedAt ? `concluída em ${dataPorExtenso(dateKeyOf(meta.completedAt, timeZone), hoje)}` : 'concluída';
  }
  return meta.targetDate ? `até ${dataPorExtenso(meta.targetDate, hoje)}` : 'sem data';
}

/** Os dias até o prazo, "hoje" no dia e "vencida" depois dele. Um traço sem data ou na meta concluída. */
export function textoDosDias(meta: Goal, dias: number | null): string {
  if (meta.state === 'concluida' || dias === null) return '—';
  if (dias === 0) return 'hoje';
  return dias < 0 ? 'vencida' : String(dias);
}

/** Linhas do campo de marcos: uma por marco, sem as vazias. */
export function marcosDoTexto(texto: string): string[] {
  return texto
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean);
}

export interface BuscaDeMetas {
  /** A meta que abre junto com a tela (o "Ver meta" do hábito). */
  meta?: EntityId;
  /** Abre já com o formulário de meta nova (o "Criar meta" do trilho). */
  nova?: boolean;
}

export function lerBuscaDeMetas(busca: Record<string, unknown>): BuscaDeMetas {
  return {
    ...(typeof busca.meta === 'string' && busca.meta ? { meta: busca.meta } : {}),
    ...(busca.nova === true ? { nova: true } : {}),
  };
}
