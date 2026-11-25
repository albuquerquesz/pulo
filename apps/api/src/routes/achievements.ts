import { computeAchievements } from '@pulo/core/domain/achievements';
import { achievementMapper } from '@pulo/db';
import { Hono } from 'hono';
import { type AppEnv, type RouteDeps, requireSession } from '../http';
import { achievementReads, achievementSummaryFromRows, streakFromRows, streakReads } from '../queries';

/** Conquistas: `/api/achievements`. Só leitura (quem grava são as escritas que as destravam). Cinco leituras fixas. */
export function achievementRoutes({ auth, db, now }: RouteDeps) {
  return new Hono<AppEnv>().use(requireSession(auth)).get('/', async (c) => {
    const { id: userId, metadata } = c.var.user;
    const [unlocked, casa, habitDays, sessions, restDays] = await db.$transaction([
      ...achievementReads(db, userId),
      ...streakReads(db, userId),
    ]);
    const rows = { habitDays, sessions, restDays, casa };
    const summary = achievementSummaryFromRows(streakFromRows(metadata, now(), rows), rows);
    return c.json({ achievements: computeAchievements(summary, unlocked.map(achievementMapper.toDomain)) });
  });
}
