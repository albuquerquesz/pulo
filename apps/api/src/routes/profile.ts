import { dateKeyOf } from '@pulo/core/domain/day';
import { resumoDoGelo } from '@pulo/core/domain/gelo';
import { joiasGanhas } from '@pulo/core/domain/joias';
import { computeMetrics } from '@pulo/core/domain/metricas';
import { dateToMs, freezeUseMapper, toWeekday } from '@pulo/db';
import { Hono } from 'hono';
import { acertarGeloDaPessoa } from '../gelo';
import { type AppEnv, type RouteDeps, requireSession } from '../http';
import { lerFontesDeJoias } from '../joias';
import { freezeUseSelect } from '../selects';

/** `GET /api/profile/metrics`: os números do Perfil, calculados no servidor. Número fixo de queries. */
export function profileRoutes({ auth, db, now }: RouteDeps) {
  return new Hono<AppEnv>().use(requireSession(auth)).get('/metrics', async (c) => {
    const { id: userId, createdAt, metadata } = c.var.user;
    const { timezone: timeZone, vacation } = metadata;
    const dayStartMinutes = metadata.profile?.dayStartMinutes;
    const serverNow = now();
    await acertarGeloDaPessoa(db, c.var.user, serverNow);
    const where = { userId };
    const data = await db.$transaction(async (tx) => ({
      fontes: await lerFontesDeJoias(tx, userId),
      habits: await tx.habit.findMany({ where, select: { id: true, weekdays: true, state: true, createdAt: true } }),
      tarefasConcluidas: await tx.task.count({ where: { userId, status: 'feito' } }),
      usos: await tx.freezeUse.findMany({ where, select: freezeUseSelect }),
      gelosComprados: await tx.islandPurchase.count({ where: { userId, kind: 'gelo' } }),
    }));
    const { fontes } = data;
    const gelo = resumoDoGelo(data.gelosComprados, data.usos.map(freezeUseMapper.toDomain));
    const metrics = computeMetrics({
      habits: data.habits.map((habit) => ({
        id: habit.id,
        state: habit.state,
        weekdays: habit.weekdays.map(toWeekday),
        ...(habit.createdAt === null ? {} : { criadoEm: dateKeyOf(dateToMs(habit.createdAt), timeZone, dayStartMinutes) }),
      })),
      habitLogs: fontes.habitLogs,
      sessions: fontes.sessions,
      restDays: fontes.restDays,
      vacation,
      gelo: { usadosTotal: data.usos.length, guardados: gelo.guardados },
      feitos: {
        tarefasConcluidas: data.tarefasConcluidas,
        metasConcluidas: fontes.goals.filter((goal) => goal.state === 'concluida').length,
        joiasGanhas: joiasGanhas(fontes).total,
      },
      createdAt,
      timeZone,
      dayStartMinutes,
      now: serverNow,
    });
    return c.json({ metrics });
  });
}
