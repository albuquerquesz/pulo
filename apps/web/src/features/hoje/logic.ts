import { FOCUS } from '@pulo/core/config/decisions';
import { registrarCheckIn, latestEnergyToday } from '@pulo/core/domain/checkin';
import { dateKeyOf, weekdayOf } from '@pulo/core/domain/day';
import { hasTimeRunOut, iniciarFoco } from '@pulo/core/domain/foco';
import { habitsForDate, marcarHabito, desmarcarHabito } from '@pulo/core/domain/habits';
import { refreshMascotState, type MascotRefresh } from '@pulo/core/domain/phase';
import { blocksForWeekday, concluirBloco, registrarDescanso } from '@pulo/core/domain/routine';
import type {
  Clock,
  DateKey,
  Energy,
  FocusSession,
  FrogMood,
  Habit,
  MascotState,
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
  energia: Energy | null;
  descansoHoje: boolean;
  sessaoAtiva: FocusSession | null;
  /** Há algum bloco em toda a rotina (para o estado vazio). */
  temRotina: boolean;
}

export async function carregarHoje(repo: Repository, clock: Clock, user: User): Promise<DadosHoje> {
  const agora = clock.now();
  const tz = user.timezone;
  const hoje = dateKeyOf(agora, tz);
  const [blocks, habits, logs, sessions, checkIns, restDays, refresh, resumo] = await Promise.all([
    repo.listBlocks(),
    repo.listHabits(),
    repo.listHabitLogs({ from: hoje, to: hoje }),
    repo.listSessions(),
    repo.listCheckIns({ from: hoje, to: hoje }),
    repo.listRestDays(),
    refreshMascotState(repo, tz, agora),
    loadWeekSummary(repo, hoje, tz),
  ]);
  const ativa = sessions.find((s) => s.state === 'em_andamento');
  const descansoHoje = restDays.some((r) => r.date === hoje);
  const feitos = new Set(
    sessions
      .filter((s) => s.state === 'concluida' && s.blockId && dateKeyOf(s.startedAt, tz) === hoje)
      .map((s) => s.blockId as string),
  );
  const blocos = blocksForWeekday(blocks, weekdayOf(hoje)).map((bloco) => ({
    bloco,
    feito: bloco.kind === 'descanso' ? descansoHoje : feitos.has(bloco.id),
  }));
  const doneHabits = new Set(logs.map((l) => l.habitId));
  const habitos = habitsForDate(habits, hoje).map((habito) => ({ habito, feito: doneHabits.has(habito.id) }));
  return {
    hoje,
    agora,
    mascote: refresh.state,
    marco: refresh.phaseChanged,
    resumo,
    blocos,
    habitos,
    energia: latestEnergyToday(checkIns, agora, tz),
    descansoHoje,
    sessaoAtiva: ativa && !hasTimeRunOut(ativa, agora) ? ativa : null,
    temRotina: blocks.length > 0,
  };
}

export async function registrarEnergia(repo: Repository, clock: Clock, user: User, energia: Energy) {
  return registrarCheckIn(repo, energia, clock.now(), user.timezone);
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

/** Frase curta do balão. Tom leve, sem culpa. */
export function fraseDoSapo(humor: FrogMood, d: Pick<DadosHoje, 'blocos' | 'habitos' | 'descansoHoje'>): string {
  switch (humor) {
    case 'cansado':
      return 'Hoje pede casco. Vamos com calma.';
    case 'focado':
      return 'Estou aqui com você. Um foco de cada vez.';
    case 'feliz':
      return 'Que pulinho bom!';
    case 'surpreso':
      return 'Olha só, notei uma coisa na sua semana!';
    case 'pouso':
      return 'Cheguei a um lugar novo da lagoa!';
    case 'pensando':
      return 'Deixa eu pensar um pouquinho...';
    case 'dormindo':
      return 'Zzz. Amanhã a gente pula de novo.';
    default: {
      if (d.descansoHoje) return 'Descansar também é cuidar. A lagoa agradece.';
      const todos = [...d.blocos.map((b) => b.feito), ...d.habitos.map((h) => h.feito)];
      if (todos.length > 0 && todos.every(Boolean)) return 'Tudo feito por hoje. Que dia bonito na lagoa!';
      return 'Um passinho de cada vez, no seu ritmo.';
    }
  }
}
