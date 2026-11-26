import type { DateRangeQuery } from '@pulo/core/api/schemas';
import { type AchievementSummary, summarizeForAchievements } from '@pulo/core/domain/achievements';
import { addDays, startOfLogicalDay, weekEndOf } from '@pulo/core/domain/day';
import { computeStats } from '@pulo/core/domain/stats';
import { computeStreak } from '@pulo/core/domain/streak';
import type { UserMetadata } from '@pulo/core/domain/user-metadata';
import type { MascotState, ProfileStats, Streak, WeekSummary } from '@pulo/core/domain/types';
import { computeMascotState } from '@pulo/core/domain/phase';
import { buildWeekSummary } from '@pulo/core/domain/week-summary';
import { type Db, type Prisma, dateKeyToDate, focusSessionMapper, freezeUseMapper, habitLogMapper, islandPurchaseMapper, mascotStateMapper, restDayMapper } from '@pulo/db';
import type { Client } from './http';
import { achievementSelect, freezeUseSelect, habitLogSelect, islandPurchaseSelect, mascotSelect, restDaySelect, sessionSelect } from './selects';

/** Filtro de uma coluna `date` por intervalo de DateKey (extremos incluídos); sem extremos, sem filtro. */
export function dateFilter(range: DateRangeQuery): { gte?: Date; lte?: Date } | undefined {
  if (range.from === undefined && range.to === undefined) return undefined;
  return {
    ...(range.from === undefined ? {} : { gte: dateKeyToDate(range.from) }),
    ...(range.to === undefined ? {} : { lte: dateKeyToDate(range.to) }),
  };
}

/**
 * Sessões do intervalo: as que terminaram dentro dos dias lógicos (no fuso da pessoa) mais a que está em andamento,
 * sempre, para o app reencontrar o foco aberto. Uma query, sem filtro por item.
 */
export function sessionRangeWhere(userId: string, range: DateRangeQuery, timeZone: string): Prisma.FocusSessionWhereInput {
  const gte = range.from === undefined ? undefined : new Date(startOfLogicalDay(range.from, timeZone));
  const lt = range.to === undefined ? undefined : new Date(startOfLogicalDay(addDays(range.to, 1), timeZone));
  if (gte === undefined && lt === undefined) return { userId };
  return {
    userId,
    OR: [{ endedAt: { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) } }, { state: 'em_andamento' }],
  };
}

export async function readMascot(client: Client, userId: string): Promise<MascotState | null> {
  const row = await client.mascotState.findUnique({ where: { userId }, select: mascotSelect });
  return row === null ? null : mascotStateMapper.toDomain(row);
}

/**
 * Recalcula o estado do sapo com a lógica do core (a fase nunca regride) e grava em `mascot_state`.
 * Chame quando uma escrita pode mudar os dias de cuidado. Quatro queries fixas: sessões encerradas, dias de descanso,
 * estado anterior e o upsert (as leituras não crescem em número com os dados).
 */
export async function refreshMascot(client: Client, userId: string, timeZone: string, now: number): Promise<MascotState> {
  const sessions = await client.focusSession.findMany({
    where: { userId, state: { not: 'em_andamento' } },
    select: sessionSelect,
  });
  const restDays = await client.restDay.findMany({ where: { userId }, select: restDaySelect });
  const previous = await readMascot(client, userId);
  const state = computeMascotState(
    sessions.map(focusSessionMapper.toDomain),
    restDays.map(restDayMapper.toDomain),
    timeZone,
    previous,
    now,
  );
  const row = mascotStateMapper.fromDomain(userId, state);
  await client.mascotState.upsert({
    where: { userId },
    create: row,
    update: { phase: row.phase, careDays: row.careDays, updatedAt: row.updatedAt },
  });
  return state;
}

/** As três leituras do resumo da semana, para entrar numa `db.$transaction([...])` (ordem: sessões, descansos, hábitos feitos). */
export function weekSummaryReads(db: Db, userId: string, timeZone: string, weekStart: string) {
  const range = { from: weekStart, to: weekEndOf(weekStart) };
  const date = dateFilter(range);
  return [
    db.focusSession.findMany({ where: sessionRangeWhere(userId, range, timeZone), select: sessionSelect }),
    db.restDay.findMany({ where: { userId, date }, select: restDaySelect }),
    db.habitLog.findMany({ where: { userId, date }, select: habitLogSelect }),
  ] as const;
}

type WeekSummaryRows = {
  sessions: Parameters<typeof focusSessionMapper.toDomain>[0][];
  restDays: Parameters<typeof restDayMapper.toDomain>[0][];
  habitLogs: Parameters<typeof habitLogMapper.toDomain>[0][];
};

export function summaryFromRows(weekStart: string, timeZone: string, rows: WeekSummaryRows): WeekSummary {
  return buildWeekSummary({
    weekStart,
    timeZone,
    sessions: rows.sessions.map(focusSessionMapper.toDomain),
    restDays: rows.restDays.map(restDayMapper.toDomain),
    habitLogs: rows.habitLogs.map(habitLogMapper.toDomain),
  });
}

/**
 * As quatro leituras da sequência, para entrar numa `db.$transaction([...])`. Todo o histórico (o recorde é calculado,
 * nunca gravado), mas os hábitos feitos já vêm agrupados em uma linha por dia.
 */
export function streakReads(db: Db, userId: string) {
  return [
    db.habitLog.groupBy({ by: ['date'], where: { userId }, orderBy: { date: 'asc' }, _count: { habitId: true } }),
    db.focusSession.findMany({ where: { userId, state: { not: 'em_andamento' } }, select: sessionSelect }),
    db.restDay.findMany({ where: { userId }, select: restDaySelect }),
    db.freezeUse.findMany({ where: { userId }, select: freezeUseSelect, orderBy: { date: 'asc' } }),
  ] as const;
}

/** O que o acerto do gelo lê além da sequência (ordem: gelos comprados, último dia resolvido). */
export function freezeReads(db: Db, userId: string) {
  return [
    db.islandPurchase.count({ where: { userId, kind: 'gelo' } }),
    db.mascotState.findUnique({ where: { userId }, select: { geloResolvidoAte: true } }),
  ] as const;
}

export type StreakRows = {
  habitDays: { date: Date }[];
  sessions: Parameters<typeof focusSessionMapper.toDomain>[0][];
  restDays: Parameters<typeof restDayMapper.toDomain>[0][];
  freezeUses: Parameters<typeof freezeUseMapper.toDomain>[0][];
};

/** As linhas do histórico no formato das regras de sequência e de gelo do core. */
export function streakInput(metadata: UserMetadata, now: number, rows: StreakRows) {
  return {
    habitLogs: rows.habitDays.map(restDayMapper.toDomain),
    sessions: rows.sessions.map(focusSessionMapper.toDomain),
    restDays: rows.restDays.map(restDayMapper.toDomain),
    freezes: rows.freezeUses.map((row) => freezeUseMapper.toDomain(row).date),
    vacation: metadata.vacation,
    timeZone: metadata.timezone,
    dayStartMinutes: metadata.profile?.dayStartMinutes,
    now,
  };
}

export function streakFromRows(metadata: UserMetadata, now: number, rows: StreakRows): Streak {
  return computeStreak(streakInput(metadata, now, rows));
}

/**
 * As leituras das conquistas além das três da sequência, para entrar numa `db.$transaction([...])`
 * (ordem: gravadas, partes da casa compradas).
 */
export function achievementReads(db: Db, userId: string) {
  return [
    db.achievement.findMany({ where: { userId }, select: achievementSelect }),
    db.islandPurchase.findMany({ where: { userId, kind: 'casa' }, select: islandPurchaseSelect, orderBy: { createdAt: 'asc' } }),
  ] as const;
}

type AchievementRows = StreakRows & { casa: Parameters<typeof islandPurchaseMapper.toDomain>[0][] };

/** O resumo que as regras olham, a partir das linhas de todo o histórico e da sequência já calculada. */
export function achievementSummaryFromRows(streak: Streak, rows: AchievementRows): AchievementSummary {
  return summarizeForAchievements({
    sequencia: streak,
    sessions: rows.sessions.map(focusSessionMapper.toDomain),
    descansos: rows.restDays.length,
    casa: rows.casa.map(islandPurchaseMapper.toDomain),
    gelosUsados: rows.freezeUses.length,
  });
}

/** Pomodoros por tarefa de todo o histórico: as sessões concluídas, contadas pelo banco numa query. */
export function pomodoroRead(db: Db, userId: string) {
  return db.focusSession.groupBy({
    by: ['taskId'],
    where: { userId, state: 'concluida', taskId: { not: null } },
    orderBy: { taskId: 'asc' },
    _count: { id: true },
  });
}

export function pomodorosFromRows(rows: { taskId: string | null; _count: { id: number } }[]): Record<string, number> {
  return Object.fromEntries(rows.flatMap((row) => (row.taskId === null ? [] : [[row.taskId, row._count.id]])));
}

/** Estatísticas de todo o tempo. Os hábitos feitos chegam contados pelo banco; o foco sai das sessões terminadas. */
export function statsFromRows(desde: number, habitosFeitos: number, sessions: StreakRows['sessions']): ProfileStats {
  return computeStats({ desde, habitosFeitos, sessions: sessions.map(focusSessionMapper.toDomain) });
}
