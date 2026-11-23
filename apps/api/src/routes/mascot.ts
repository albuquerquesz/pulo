import { Hono } from 'hono';
import { type AppEnv, type RouteDeps, requireSession } from '../http';
import { readMascot } from '../queries';

/** Estado do sapo: `/api/mascot`. Só leitura; quem grava é a escrita de sessão e de descanso. */
export function mascotRoutes({ auth, db }: RouteDeps) {
  return new Hono<AppEnv>().use(requireSession(auth)).get('/', async (c) => {
    return c.json({ mascot: await readMascot(db, c.var.user.id) });
  });
}
