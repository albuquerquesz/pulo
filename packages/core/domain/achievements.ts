import { ACHIEVEMENTS, DEFAULT_TIMEZONE } from '../config/decisions';
import { partesDaCasa } from './casa';
import { MINUTE_MS } from './clock';
import { listFreezeDatesOf } from './gelo-store';
import { focusedMs } from './joias';
import { computeStreak } from './streak';
import type { Achievement, AchievementId, Clock, FocusSession, Purchase, Repository, Streak, UnlockedAchievement } from './types';

/** O que as regras olham: só contagens e sequências, nunca o banco. */
export interface AchievementSummary {
  sequencia: Pick<Streak, 'atual' | 'recorde'>;
  /** Minutos inteiros focados na maior sessão encerrada. */
  maiorFocoMinutos: number;
  descansos: number;
  partesConstruidas: number;
  /** Gelos já gastos (spec 29). */
  gelosUsados: number;
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
  'casa-inteira': (summary) => summary.partesConstruidas,
  'gelo-na-hora': (summary) => summary.gelosUsados,
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
}

export function summarizeForAchievements({ sequencia, sessions, descansos, casa, gelosUsados }: AchievementSources): AchievementSummary {
  const longest = sessions.reduce((max, session) => Math.max(max, focusedMs(session)), 0);
  return {
    sequencia,
    maiorFocoMinutos: Math.floor(longest / MINUTE_MS),
    descansos,
    partesConstruidas: partesDaCasa(casa).filter((parte) => parte.construida).length,
    gelosUsados,
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

/** As conquistas de um repositório: as do servidor, quando ele as fornece; senão (demo, memória), calculadas dos registros, sem data. */
export async function verConquistas(repo: Repository, clock: Clock): Promise<Achievement[]> {
  if (providesAchievements(repo)) return repo.getAchievements();
  const [user, habitLogs, sessions, restDays, casa, freezes] = await Promise.all([
    repo.getUser(),
    repo.listHabitLogs(),
    repo.listSessions(),
    repo.listRestDays(),
    repo.listHousePurchases(),
    listFreezeDatesOf(repo),
  ]);
  const sequencia = computeStreak({
    habitLogs,
    sessions,
    restDays,
    freezes,
    timeZone: user?.timezone ?? DEFAULT_TIMEZONE,
    dayStartMinutes: user?.dayStartMinutes,
    now: clock.now(),
  });
  const summary = summarizeForAchievements({ sequencia, sessions, descansos: restDays.length, casa, gelosUsados: freezes.length });
  const passing = new Set(passingAchievements(summary));
  return ACHIEVEMENTS.map(({ id }) => (passing.has(id) ? earnedAchievement(id) : pending(id, summary)));
}
