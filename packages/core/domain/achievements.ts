import { ACHIEVEMENTS, DEFAULT_TIMEZONE, JOIAS } from '../config/decisions';
import { comodosProntos, partesDaCasa } from './casa';
import { MINUTE_MS } from './clock';
import { periodOf } from './day';
import { listFreezeDatesOf } from './gelo-store';
import { contarPorDia, focusedMs, joiasDosHabitos, joiasGanhas } from './joias';
import { computeStreak } from './streak';
import type { Achievement, AchievementId, Clock, FocusSession, Goal, GoalChest, HabitLog, Purchase, Repository, Streak, UnlockedAchievement } from './types';

/** O que as regras olham: só contagens e sequências, nunca o banco. */
export interface AchievementSummary {
  sequencia: Pick<Streak, 'atual' | 'recorde'>;
  /** Minutos inteiros focados na maior sessão encerrada. */
  maiorFocoMinutos: number;
  descansos: number;
  partesConstruidas: number;
  /** Cômodos prontos (o quarto conta). */
  comodos: number;
  temSegundoAndar: boolean;
  /** Gelos já gastos (spec 29). */
  gelosUsados: number;
  focosConcluidos: number;
  /** Focos concluídos que começaram de manhã (`PERIODS.manha`, no fuso da pessoa). */
  focosDeManha: number;
  /** Horas inteiras focadas em todas as sessões encerradas. */
  horasDeFoco: number;
  /** Marcações do hábito mais marcado. */
  maiorHabito: number;
  /** Marcações de todos os hábitos. */
  marcacoes: number;
  tarefasConcluidas: number;
  metasConcluidas: number;
  marcosConcluidos: number;
  joias: number;
  decoracoes: number;
}

/** Quanto a pessoa já andou rumo à `meta`. Chegar nela conquista. */
type Rule = (summary: AchievementSummary, meta: number) => number;

/** Dias seguidos: um recorde antigo já vale; antes disso, o que conta é a sequência viva. */
const streakDays: Rule = ({ sequencia }, meta) => (sequencia.recorde >= meta ? meta : sequencia.atual);

const RULES: Record<AchievementId, Rule> = {
  'primeira-semana': streakDays,
  'foco-profundo': (summary) => summary.maiorFocoMinutos,
  'descanso-sabido': (summary) => summary.descansos,
  'mes-de-fogo': streakDays,
  'dois-andares': (summary) => Number(summary.temSegundoAndar),
  'cinco-comodos': (summary) => summary.comodos,
  'casa-inteira': (summary) => summary.partesConstruidas,
  'gelo-na-hora': (summary) => summary.gelosUsados,
  'primeiro-foco': (summary) => summary.focosConcluidos,
  'vinte-cinco-focos': (summary) => summary.focosConcluidos,
  'dez-horas': (summary) => summary.horasDeFoco,
  madrugador: (summary) => summary.focosDeManha,
  'habito-firme': (summary) => summary.maiorHabito,
  'cem-marcas': (summary) => summary.marcacoes,
  'dez-tarefas': (summary) => summary.tarefasConcluidas,
  'cinquenta-tarefas': (summary) => summary.tarefasConcluidas,
  'primeira-meta': (summary) => summary.metasConcluidas,
  'dez-marcos': (summary) => summary.marcosConcluidos,
  'quinhentas-joias': (summary) => summary.joias,
  'quarto-decorado': (summary) => summary.decoracoes,
  'cem-dias': streakDays,
  // Sem regra escolhida ainda.
  segredo: () => 0,
};

export interface AchievementSources {
  /** A sequência já calculada (`computeStreak`). */
  sequencia: Pick<Streak, 'atual' | 'recorde'>;
  sessions: readonly FocusSession[];
  descansos: number;
  casa: readonly Purchase[];
  gelosUsados: number;
  timeZone: string;
  /** Quantas vezes cada hábito foi marcado, um número por hábito. */
  marcacoesPorHabito: readonly number[];
  /** Quantos hábitos foram feitos em cada dia (para o teto de joias por dia). */
  marcacoesPorDia: readonly number[];
  tarefasConcluidas: number;
  goals: readonly Goal[];
  baus: readonly GoalChest[];
  /** Crédito histórico de joias. */
  credito: number;
  decoracoes: number;
}

/** Quantas vezes cada hábito aparece nas marcações. */
export function countByHabit(habitLogs: readonly HabitLog[]): number[] {
  const counts = new Map<string, number>();
  for (const { habitId } of habitLogs) counts.set(habitId, (counts.get(habitId) ?? 0) + 1);
  return [...counts.values()];
}

export function summarizeForAchievements(sources: AchievementSources): AchievementSummary {
  const { sequencia, sessions, descansos, casa, gelosUsados, timeZone, marcacoesPorHabito, goals, baus, credito } = sources;
  const focused = sessions.map(focusedMs);
  const longest = focused.reduce((max, ms) => Math.max(max, ms), 0);
  const total = focused.reduce((sum, ms) => sum + ms, 0);
  const done = sessions.filter((session) => session.state === 'concluida');
  const marcacoes = marcacoesPorHabito.reduce((sum, count) => sum + count, 0);
  const partes = partesDaCasa(casa);
  // Hábitos e descansos chegam contados: a joia deles soma por fora.
  const outrasJoias = joiasGanhas({ habitLogs: [], sessions, restDays: [], goals, baus, credito }).total;
  return {
    sequencia,
    maiorFocoMinutos: Math.floor(longest / MINUTE_MS),
    descansos,
    partesConstruidas: partes.filter((parte) => parte.construida).length,
    comodos: comodosProntos(partes).length,
    temSegundoAndar: partes.some((parte) => parte.id === 'segundo-andar' && parte.construida),
    gelosUsados,
    focosConcluidos: done.length,
    focosDeManha: done.filter((session) => periodOf(session.startedAt, timeZone) === 'manha').length,
    horasDeFoco: Math.floor(total / (60 * MINUTE_MS)),
    maiorHabito: marcacoesPorHabito.reduce((max, count) => Math.max(max, count), 0),
    marcacoes,
    tarefasConcluidas: sources.tarefasConcluidas,
    metasConcluidas: goals.filter((goal) => goal.state === 'concluida').length,
    marcosConcluidos: goals.reduce((sum, goal) => sum + goal.milestones.filter((m) => m.doneAt !== undefined).length, 0),
    joias: outrasJoias + joiasDosHabitos(sources.marcacoesPorDia) + descansos * JOIAS.por.restDay,
    decoracoes: sources.decoracoes,
  };
}

/** As conquistas que a regra já dá, estejam gravadas ou não. */
export function passingAchievements(summary: AchievementSummary): AchievementId[] {
  return ACHIEVEMENTS.filter(({ id, meta }) => RULES[id](summary, meta) >= meta).map(({ id }) => id);
}

/** Uma conquista que a pessoa tem, com nome e emoji do catálogo. */
export function earnedAchievement(id: AchievementId, conquistadaEm?: number): Achievement {
  const { nome, emoji, meta } = catalogEntry(id);
  return { id, nome, emoji, conquistada: true, ...(conquistadaEm === undefined ? {} : { conquistadaEm }), progresso: meta, meta };
}

function catalogEntry(id: AchievementId) {
  const entry = ACHIEVEMENTS.find((item) => item.id === id);
  if (!entry) throw new RangeError(`conquista fora do catálogo: ${id}`);
  return entry;
}

function pending(id: AchievementId, summary: AchievementSummary): Achievement {
  const { nome, emoji, meta, secreta } = catalogEntry(id);
  const progresso = Math.min(meta, RULES[id](summary, meta));
  return { id, ...(secreta ? {} : { nome, emoji }), conquistada: false, progresso, meta };
}

/**
 * O catálogo inteiro para a pessoa. Conquistada é a que está gravada (não some, mesmo que os registros sejam apagados);
 * uma regra que já passa e ainda não foi gravada aparece com o progresso cheio até a próxima escrita.
 */
export function computeAchievements(summary: AchievementSummary, unlocked: readonly UnlockedAchievement[]): Achievement[] {
  const dates = new Map(unlocked.map((item) => [item.id, item.conquistadaEm]));
  return ACHIEVEMENTS.map(({ id }) => {
    const date = dates.get(id);
    return date === undefined ? pending(id, summary) : earnedAchievement(id, date);
  });
}

/** Repositório que já recebe as conquistas prontas (o remoto: o servidor enxerga todo o histórico e guarda as datas). */
export interface AchievementSource {
  getAchievements(): Promise<Achievement[]>;
}

export function providesAchievements(repo: Repository): repo is Repository & AchievementSource {
  return 'getAchievements' in repo && typeof repo.getAchievements === 'function';
}

/** As conquistas de um repositório: as do servidor, quando ele as fornece; senão (memória), calculadas dos registros, sem data. */
export async function verConquistas(repo: Repository, clock: Clock): Promise<Achievement[]> {
  if (providesAchievements(repo)) return repo.getAchievements();
  const [user, habitLogs, sessions, restDays, casa, freezes, tasks, goals, baus, credito, decor] = await Promise.all([
    repo.getUser(),
    repo.listHabitLogs(),
    repo.listSessions(),
    repo.listRestDays(),
    repo.listHousePurchases(),
    listFreezeDatesOf(repo),
    repo.listTasks(),
    repo.listGoals(),
    repo.listGoalChests(),
    repo.getJoiaCredit(),
    repo.listRoomDecor(),
  ]);
  const timeZone = user?.timezone ?? DEFAULT_TIMEZONE;
  const sequencia = computeStreak({
    habitLogs,
    sessions,
    restDays,
    freezes,
    timeZone,
    dayStartMinutes: user?.dayStartMinutes,
    now: clock.now(),
  });
  const summary = summarizeForAchievements({
    sequencia,
    sessions,
    descansos: restDays.length,
    casa,
    gelosUsados: freezes.length,
    timeZone,
    marcacoesPorHabito: countByHabit(habitLogs),
    marcacoesPorDia: contarPorDia(habitLogs),
    tarefasConcluidas: tasks.filter((task) => task.status === 'feito').length,
    goals,
    baus,
    credito,
    decoracoes: decor.length,
  });
  const passing = new Set(passingAchievements(summary));
  return ACHIEVEMENTS.map(({ id }) => (passing.has(id) ? earnedAchievement(id) : pending(id, summary)));
}
