import { earnedAchievement, passingAchievements } from '@pulo/core/domain/achievements';
import type { Achievement } from '@pulo/core/domain/types';
import type { Db } from '@pulo/db';
import type { SessionUser } from './http';
import { acertarGelos } from './gelo';
import { achievementReads, achievementSummaryFromRows, freezeReads, streakFromRows, streakReads } from './queries';

/**
 * Grava as conquistas que as regras passaram a dar e devolve só as gravadas agora (a comemoração acontece uma vez).
 * Chame DEPOIS da escrita confirmada: assim duas escritas simultâneas enxergam uma à outra, e se algo falhar aqui,
 * repetir o `PUT` (idempotente) tenta de novo. Antes das regras acerta o gelo dos dias fechados, que muda a sequência.
 * Quatorze leituras fixas; só grava quando há gelo a acertar ou conquista nova.
 */
export async function unlockAchievements(db: Db, person: SessionUser, now: number): Promise<Achievement[]> {
  const { id: userId, metadata } = person;
  const [unlocked, casa, habitMarks, tarefasConcluidas, goals, goalChests, joiaCredit, decoracoes, habitDays, sessions, restDays, freezeUses, gelosComprados, resolvido] = await db.$transaction([
    ...achievementReads(db, userId),
    ...streakReads(db, userId),
    ...freezeReads(db, userId),
  ]);
  const lidas = { habitDays, sessions, restDays, freezeUses };
  const acerto = await acertarGelos(db, person, now, { ...lidas, gelosComprados, resolvido });
  const rows = { ...lidas, freezeUses: acerto.freezeUses, casa, habitMarks, tarefasConcluidas, goals, goalChests, joiaCredit, decoracoes };
  const owned = new Set(unlocked.map((row) => row.achievement));
  const summary = achievementSummaryFromRows(metadata, streakFromRows(metadata, now, rows), rows);
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
