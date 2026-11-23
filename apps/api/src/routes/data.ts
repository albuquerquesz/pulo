import { Hono } from 'hono';
import { type AppEnv, type RouteDeps, requireSession } from '../http';

/**
 * `DELETE /api/data`: o `clearAll` do servidor, único jeito de zerar o progresso. Apaga tudo do domínio da pessoa
 * (rotina, hábitos e registros, sessões, check ins, descansos, propostas e o sapo). A conta, o login e os
 * metadados (tema, fuso, onboarding) ficam. Sete deletes numa transação.
 */
export function dataRoutes({ auth, db }: RouteDeps) {
  return new Hono<AppEnv>().use(requireSession(auth)).delete('/', async (c) => {
    const where = { userId: c.var.user.id };
    const [sessions, blocks, habits, restDays, proposals, mascot] = await db.$transaction([
      db.focusSession.deleteMany({ where }),
      db.routineBlock.deleteMany({ where }),
      // Os registros de hábito saem junto (cascade).
      db.habit.deleteMany({ where }),
      db.restDay.deleteMany({ where }),
      db.weeklyProposal.deleteMany({ where }),
      db.mascotState.deleteMany({ where }),
    ]);
    return c.json({
      deleted: {
        sessions: sessions.count,
        blocks: blocks.count,
        habits: habits.count,
        restDays: restDays.count,
        proposals: proposals.count,
        mascot: mascot.count,
      },
    });
  });
}
