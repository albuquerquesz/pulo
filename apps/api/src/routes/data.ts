import { dateKeyOf } from '@pulo/core/domain/day';
import { Hono } from 'hono';
import { exportData } from '../export';
import { type AppEnv, type RouteDeps, requireSession } from '../http';

/**
 * `DELETE /api/data`: o `clearAll` do servidor, único jeito de zerar o progresso. Apaga tudo do domínio da pessoa
 * (rotina, hábitos e registros, sessões, descansos, propostas, metas (com os baús), tarefas (com subtarefas, comentários e histórico), compras com joias, crédito de joias, conquistas e o sapo). A conta, o login e os
 * metadados (tema, fuso, onboarding) ficam. As posições do quarto saem com as compras (cascade). Doze deletes numa transação.
 */
export function dataRoutes({ auth, db, now }: RouteDeps) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/export', async (c) => {
      const exportedAt = now();
      const file = await exportData(db, c.var.user, exportedAt);
      c.header('Content-Disposition', `attachment; filename="pulo-dados-${dateKeyOf(exportedAt, c.var.user.metadata.timezone)}.json"`);
      c.header('Cache-Control', 'no-store');
      return c.json(file);
    })
    .delete('/', async (c) => {
    const where = { userId: c.var.user.id };
    const [sessions, blocks, habits, restDays, proposals, goals, islandPurchases, mascot, , , tasks, achievements] = await db.$transaction([
      db.focusSession.deleteMany({ where }),
      db.routineBlock.deleteMany({ where }),
      // Os registros de hábito saem junto (cascade).
      db.habit.deleteMany({ where }),
      db.restDay.deleteMany({ where }),
      db.weeklyProposal.deleteMany({ where }),
      db.goal.deleteMany({ where }),
      db.islandPurchase.deleteMany({ where }),
      db.mascotState.deleteMany({ where }),
      db.joiaCredit.deleteMany({ where }),
      db.taskCounter.deleteMany({ where }),
      // Subtarefas, comentários e eventos saem junto (cascade).
      db.task.deleteMany({ where }),
      db.achievement.deleteMany({ where }),
    ]);
    return c.json({
      deleted: {
        sessions: sessions.count,
        blocks: blocks.count,
        habits: habits.count,
        restDays: restDays.count,
        proposals: proposals.count,
        goals: goals.count,
        islandPurchases: islandPurchases.count,
        mascot: mascot.count,
        tasks: tasks.count,
        achievements: achievements.count,
      },
    });
  });
}
