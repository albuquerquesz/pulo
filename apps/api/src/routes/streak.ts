import { Hono } from 'hono';
import { acertarGeloDaPessoa } from '../gelo';
import { type AppEnv, type RouteDeps, requireSession } from '../http';
import { streakFromRows } from '../queries';

/** Sequência com foguinho: `/api/streak`. Acerta o gelo dos dias fechados e aplica `computeStreak` do core. */
export function streakRoutes({ auth, db, now }: RouteDeps) {
  return new Hono<AppEnv>().use(requireSession(auth)).get('/', async (c) => {
    const serverNow = now();
    const rows = await acertarGeloDaPessoa(db, c.var.user, serverNow);
    return c.json({ streak: streakFromRows(c.var.user.metadata, serverNow, rows) });
  });
}
