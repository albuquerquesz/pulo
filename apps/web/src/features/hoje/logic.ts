import { FOCUS, PHASE_MIN_CARE_DAYS } from '@pulo/core/config/decisions';
import { dateKeyOf, localMinutesOf, weekdayOf } from '@pulo/core/domain/day';
import { hasTimeRunOut, iniciarFoco } from '@pulo/core/domain/foco';
import { habitsForDate, marcarHabito, desmarcarHabito } from '@pulo/core/domain/habits';
import { refreshMascotState, type MascotRefresh } from '@pulo/core/domain/phase';
import { blocksForWeekday, concluirBloco, registrarDescanso } from '@pulo/core/domain/routine';
import type {
  Clock,
  DateKey,
  FocusSession,
  Habit,
  MascotState,
  Phase,
  Repository,
  RoutineBlock,
  User,
  WeekSummary,
} from '@pulo/core/domain/types';
import { loadWeekSummary } from '@pulo/core/domain/week-summary';

export interface BlocoDoDia {
  bloco: RoutineBlock;
  feito: boolean;
}

export interface HabitoDoDia {
  habito: Habit;
  feito: boolean;
}

export interface DadosHoje {
  hoje: DateKey;
  agora: number;
  mascote: MascotState;
  /** Mudança de fase detectada nesta leitura (evento `marco`). */
  marco: boolean;
  resumo: WeekSummary;
  blocos: BlocoDoDia[];
  habitos: HabitoDoDia[];
  /** Primeiro bloco ainda por fazer que não acabou, ou null. */
  proximoBloco: BlocoDoDia | null;
  /** Focos interrompidos hoje: deixam o sapo cansado. */
  focosInterrompidosHoje: number;
  descansoHoje: boolean;
  sessaoAtiva: FocusSession | null;
  /** Há algum bloco em toda a rotina (para o estado vazio). */
  temRotina: boolean;
}

export async function carregarHoje(repo: Repository, clock: Clock, user: User): Promise<DadosHoje> {
  const agora = clock.now();
  const tz = user.timezone;
  const hoje = dateKeyOf(agora, tz);
  const [blocks, habits, logs, sessions, restDays, refresh, resumo] = await Promise.all([
    repo.listBlocks(),
    repo.listHabits(),
    repo.listHabitLogs({ from: hoje, to: hoje }),
    repo.listSessions(),
    repo.listRestDays(),
    refreshMascotState(repo, tz, agora),
    loadWeekSummary(repo, hoje, tz),
  ]);
  const ativa = sessions.find((s) => s.state === 'em_andamento');
  const descansoHoje = restDays.some((r) => r.date === hoje);
  const deHoje = sessions.filter((s) => dateKeyOf(s.startedAt, tz) === hoje);
  const feitos = new Set(deHoje.filter((s) => s.state === 'concluida' && s.blockId).map((s) => s.blockId as string));
  const blocos = blocksForWeekday(blocks, weekdayOf(hoje)).map((bloco) => ({
    bloco,
    feito: bloco.kind === 'descanso' ? descansoHoje : feitos.has(bloco.id),
  }));
  const doneHabits = new Set(logs.map((l) => l.habitId));
  const habitos = habitsForDate(habits, hoje).map((habito) => ({ habito, feito: doneHabits.has(habito.id) }));
  const minutosAgora = localMinutesOf(agora, tz);
  const proximoBloco = blocos.find((b) => !b.feito && b.bloco.startMinutes + b.bloco.durationMinutes > minutosAgora) ?? null;
  return {
    hoje,
    agora,
    mascote: refresh.state,
    marco: refresh.phaseChanged,
    resumo,
    blocos,
    habitos,
    proximoBloco,
    focosInterrompidosHoje: deHoje.filter((s) => s.state === 'interrompida').length,
    descansoHoje,
    sessaoAtiva: ativa && !hasTimeRunOut(ativa, agora) ? ativa : null,
    temRotina: blocks.length > 0,
  };
}

/** Quanto falta para a próxima fase. Na última fase, `faltam` é null. */
export function progressoDaFase(fase: Phase, diasDeCuidado: number): { faltam: number | null } {
  if (fase === 4) return { faltam: null };
  const proxima = PHASE_MIN_CARE_DAYS[(fase + 1) as Exclude<Phase, 1>];
  return { faltam: Math.max(1, proxima - diasDeCuidado) };
}

export async function alternarHabito(repo: Repository, clock: Clock, user: User, habitId: string, feito: boolean): Promise<boolean> {
  const hoje = dateKeyOf(clock.now(), user.timezone);
  if (feito) {
    await desmarcarHabito(repo, habitId, hoje);
    return false;
  }
  const r = await marcarHabito(repo, habitId, hoje, clock.now());
  return r.ok;
}

/** Marca um bloco de descanso como feito. Devolve a atualização do sapo. */
export async function concluirDescansoDoBloco(repo: Repository, clock: Clock, user: User, blockId: string) {
  const hoje = dateKeyOf(clock.now(), user.timezone);
  const r = await concluirBloco(repo, blockId, hoje);
  if (!r.ok) return null;
  return refreshMascotState(repo, user.timezone, clock.now());
}

/** "Dia de descanso": sem justificativa, conta como cuidado. */
export async function diaDeDescanso(repo: Repository, clock: Clock, user: User): Promise<MascotRefresh> {
  await registrarDescanso(repo, dateKeyOf(clock.now(), user.timezone));
  return refreshMascotState(repo, user.timezone, clock.now());
}

export function duracaoDoFoco(bloco?: RoutineBlock): number {
  if (!bloco) return FOCUS.defaultMinutes;
  return Math.min(FOCUS.maxMinutes, Math.max(FOCUS.minMinutes, bloco.durationMinutes));
}

/** Começa um foco, opcionalmente ligado a um bloco. */
export async function comecarFoco(repo: Repository, clock: Clock, user: User, bloco?: RoutineBlock) {
  return iniciarFoco(repo, clock, user.timezone, {
    plannedMinutes: duracaoDoFoco(bloco),
    ...(bloco ? { blockId: bloco.id } : {}),
  });
}
