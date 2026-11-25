import { Hono } from 'hono';
import { type AppEnv, type RouteDeps, requireSession } from '../http';
import { statsFromRows } from '../queries';
import { sessionSelect } from '../selects';

/** `GET /api/stats`: os números de todo o tempo do Perfil. Duas leituras fixas numa transação. */
export function statsRoutes({ auth, db }: RouteDeps) {
  return new Hono<AppEnv>().use(requireSession(auth)).get('/', async (c) => {
    const { id: userId, createdAt } = c.var.user;
    const [habitosFeitos, sessions] = await db.$transaction([
      db.habitLog.count({ where: { userId } }),
      db.focusSession.findMany({ where: { userId, state: { not: 'em_andamento' } }, select: sessionSelect }),
    ]);
    return c.json({ stats: statsFromRows(createdAt, habitosFeitos, sessions) });
  });
}
