import { Hono } from 'hono';
import { type AppEnv, type RouteDeps, requireSession } from '../http';
import { streakFromRows, streakReads } from '../queries';

/** Sequência com foguinho: `/api/streak`. Três leituras fixas numa transação e `computeStreak` do core. */
export function streakRoutes({ auth, db, now }: RouteDeps) {
  return new Hono<AppEnv>().use(requireSession(auth)).get('/', async (c) => {
    const { id: userId, metadata } = c.var.user;
    const [habitDays, sessions, restDays] = await db.$transaction([...streakReads(db, userId)]);
    return c.json({ streak: streakFromRows(metadata, now(), { habitDays, sessions, restDays }) });
  });
}
