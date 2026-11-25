import { HABITS } from '@pulo/core/config/decisions';
import { dateKeyOf, weekdayOf } from '@pulo/core/domain/day';
import { verEstatisticasDoHabito } from '@pulo/core/domain/habit-stats';
import type {
  Clock,
  DateKey,
  EntityId,
  Goal,
  GoalChest,
  Habit,
  HabitDayState,
  HabitStats,
  Period,
  Repository,
  User,
  Weekday,
} from '@pulo/core/domain/types';

const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'] as const;
const NOMES_DOS_DIAS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'] as const;
const LETRAS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] as const;
const DIAS_UTEIS = 5;

/** A ordem dos dias na tela começa no domingo, como no rascunho (0 = segunda). */
export const SEMANA_DA_TELA: readonly Weekday[] = [6, 0, 1, 2, 3, 4, 5];

export const letraDoDia = (dia: Weekday): string => LETRAS[dia];
export const nomeDoDia = (dia: Weekday): string => NOMES_DOS_DIAS[dia];

/** "todo dia", "seg a sex" ou "seg, qua, sex". */
export function textoDaFrequencia(dias: readonly Weekday[]): string {
  const ordenados = [...new Set(dias)].sort((a, b) => a - b);
  if (ordenados.length === DIAS.length) return 'todo dia';
  if (ordenados.length === DIAS_UTEIS && ordenados.every((d) => d < DIAS_UTEIS)) return 'seg a sex';
  return ordenados.map((d) => DIAS[d]).join(', ');
}

export function alternarDia(dias: readonly Weekday[], dia: Weekday): Weekday[] {
  return dias.includes(dia) ? dias.filter((d) => d !== dia) : [...dias, dia].sort((a, b) => a - b);
}

export interface PeriodoNaTela {
  chave: Period;
  icone: string;
  nome: string;
}

export const PERIODOS: readonly PeriodoNaTela[] = [
  { chave: 'manha', icone: '☀️', nome: 'Manhã' },
  { chave: 'tarde', icone: '🌤️', nome: 'Tarde' },
  { chave: 'noite', icone: '🌙', nome: 'Noite' },
];

export interface GrupoDeHabitos {
  chave: Period | 'sem_periodo' | 'pausados';
  titulo: string;
  habitos: Habit[];
}

/**
 * Manhã, Tarde e Noite sempre aparecem; "Sem período" e "Pausados" só quando têm alguém.
 * Arquivados não aparecem.
 */
export function agruparPorPeriodo(habitos: readonly Habit[]): GrupoDeHabitos[] {
  const ativos = habitos.filter((h) => h.state === 'ativo');
  const grupos: GrupoDeHabitos[] = PERIODOS.map((p) => ({
    chave: p.chave,
    titulo: `${p.icone} ${p.nome}`,
    habitos: ativos.filter((h) => h.period === p.chave),
  }));
  const extras: GrupoDeHabitos[] = [
    { chave: 'sem_periodo', titulo: '🗓️ Sem período', habitos: ativos.filter((h) => !h.period) },
    { chave: 'pausados', titulo: '⏸️ Pausados', habitos: habitos.filter((h) => h.state === 'pausado') },
  ];
  return [...grupos, ...extras.filter((g) => g.habitos.length > 0)];
}

export const iconeDoHabito = (habito: Pick<Habit, 'icon'>): string => habito.icon ?? HABITS.defaultIcon;

/** "86%", ou um traço quando ainda não há dia que conte. */
export function textoDaTaxa(taxa: number | null): string {
  return taxa === null ? '—' : `${Math.round(taxa * 100)}%`;
}

/** Minutos desde 00:00 no formato do campo de hora ("07:30"). */
export function paraCampoDeHora(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

/** O contrário de `paraCampoDeHora`; `null` para um campo vazio ou incompleto. */
export function lerCampoDeHora(texto: string): number | null {
  const partes = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(texto);
  return partes ? Number(partes[1]) * 60 + Number(partes[2]) : null;
}

export const NOME_DO_ESTADO: Record<HabitDayState, string> = {
  feito: 'feito',
  parcial: 'feito em parte',
  descanso: 'descanso',
  vazio: 'não feito',
  fora: 'fora da frequência',
  futuro: 'ainda não chegou',
};

export interface DiaDoCalendario {
  date: DateKey;
  estado: HabitDayState;
  hoje: boolean;
}

export interface LinhaDoCalendario {
  /** Só as linhas alternadas levam a letra, como no rascunho. */
  letra: string;
  dias: DiaDoCalendario[];
}

/** O calendário vem por semana; a grade é desenhada por linha (um dia da semana por linha). */
export function linhasDoCalendario(calendario: HabitStats['calendario']): LinhaDoCalendario[] {
  const hoje = calendario
    .flat()
    .filter((d) => d.estado !== 'futuro')
    .at(-1)?.date;
  const primeira = calendario[0] ?? [];
  return primeira.map((dia, linha) => ({
    letra: linha % 2 === 1 ? letraDoDia(weekdayOf(dia.date)) : '',
    dias: calendario.flatMap((semana) => {
      const d = semana[linha];
      return d ? [{ ...d, hoje: d.date === hoje }] : [];
    }),
  }));
}

export interface DadosDosHabitos {
  habitos: Habit[];
  metas: Goal[];
  baus: GoalChest[];
  feitosHoje: ReadonlySet<EntityId>;
}

export async function carregarHabitos(repo: Repository, clock: Clock, user: User): Promise<DadosDosHabitos> {
  const hoje = dateKeyOf(clock.now(), user.timezone);
  const [habitos, metas, baus, registros] = await Promise.all([
    repo.listHabits(),
    repo.listGoals(),
    repo.listGoalChests(),
    repo.listHabitLogs({ from: hoje, to: hoje }),
  ]);
  return { habitos, metas, baus, feitosHoje: new Set(registros.map((r) => r.habitId)) };
}

export type EstatisticasPorHabito = ReadonlyMap<EntityId, HabitStats>;

/** As estatísticas dos hábitos que aparecem na página (no remoto, uma chamada por hábito). */
export async function carregarEstatisticas(repo: Repository, clock: Clock): Promise<EstatisticasPorHabito> {
  const visiveis = (await repo.listHabits()).filter((h) => h.state !== 'arquivado');
  const lidas = await Promise.all(visiveis.map((h) => verEstatisticasDoHabito(repo, h.id, clock)));
  const porHabito = new Map<EntityId, HabitStats>();
  visiveis.forEach((h, i) => {
    const stats = lidas[i];
    if (stats) porHabito.set(h.id, stats);
  });
  return porHabito;
}

export interface BuscaDeHabitos {
  /** O hábito aberto (no celular, é a tela do detalhe). */
  habito?: EntityId;
}

export function lerBuscaDeHabitos(busca: Record<string, unknown>): BuscaDeHabitos {
  return typeof busca.habito === 'string' && busca.habito ? { habito: busca.habito } : {};
}
