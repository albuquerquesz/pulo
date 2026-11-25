import { earnedAchievement, passingAchievements } from '@pulo/core/domain/achievements';
import type { Achievement } from '@pulo/core/domain/types';
import type { Db } from '@pulo/db';
import type { SessionUser } from './http';
import { achievementReads, achievementSummaryFromRows, streakFromRows, streakReads } from './queries';

/**
 * Grava as conquistas que as regras passaram a dar e devolve só as gravadas agora (a comemoração acontece uma vez).
 * Chame DEPOIS da escrita confirmada: assim duas escritas simultâneas enxergam uma à outra, e se algo falhar aqui,
 * repetir o `PUT` (idempotente) tenta de novo. Cinco leituras fixas e, só quando há conquista nova, um `INSERT`.
 */
export async function unlockAchievements(db: Db, person: SessionUser, now: number): Promise<Achievement[]> {
  const { id: userId, metadata } = person;
  const [unlocked, casa, habitDays, sessions, restDays] = await db.$transaction([
    ...achievementReads(db, userId),
    ...streakReads(db, userId),
  ]);
  const rows = { habitDays, sessions, restDays, casa };
  const owned = new Set(unlocked.map((row) => row.achievement));
  const summary = achievementSummaryFromRows(streakFromRows(metadata, now, rows), rows);
  const fresh = passingAchievements(summary).filter((id) => !owned.has(id));
  if (fresh.length === 0) return [];
  // `skipDuplicates` devolve só o que esta chamada inseriu: outro aparelho não comemora a mesma de novo.
  const inserted = await db.achievement.createManyAndReturn({
    data: fresh.map((achievement) => ({ userId, achievement, conquistadaEm: new Date(now) })),
    skipDuplicates: true,
    select: { achievement: true },
  });
  const mine = new Set(inserted.map((row) => row.achievement));
  return fresh.filter((id) => mine.has(id)).map((id) => earnedAchievement(id, now));
}
