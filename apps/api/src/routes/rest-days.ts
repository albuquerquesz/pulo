import { dateParamSchema, dateRangeQuerySchema } from '@pulo/core/api/schemas';
import { dateKeyToDate, restDayMapper } from '@pulo/db';
import { type RestErrorCode, hojeDoDescanso, validarDescanso, validarDiaDoDescanso } from '@pulo/core/domain/descanso';
import { addDays, dateKeyOf } from '@pulo/core/domain/day';
import type { DateKey } from '@pulo/core/domain/types';
import { Hono } from 'hono';
import { unlockAchievements } from '../achievements';
import { acertarGeloDaPessoa } from '../gelo';
import { ApiError, type AppEnv, type Client, type RouteDeps, type SessionUser, pathParams, queryParams, requireSession } from '../http';
import { dateFilter, refreshMascot } from '../queries';
import { restDaySelect } from '../selects';

/**
 * Dias de descanso: `/api/rest-days`. Só o dia de hoje pode ser marcado ou desmarcado, até `DESCANSO.maxPorSemana` por
 * semana. Criar ou apagar um dia pode mudar os dias de cuidado, então atualiza o sapo.
 */
export function restDayRoutes({ auth, db, now }: RouteDeps) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/', queryParams(dateRangeQuerySchema), async (c) => {
      const date = dateFilter(c.req.valid('query'));
      const rows = await db.restDay.findMany({
        where: { userId: c.var.user.id, ...(date ? { date } : {}) },
        select: restDaySelect,
        orderBy: { date: 'asc' },
      });
      return c.json({ restDays: rows.map(restDayMapper.toDomain) });
    })
    .put('/:date', pathParams(dateParamSchema), async (c) => {
      const { id: userId, metadata } = c.var.user;
      const dateKey = c.req.valid('param').date;
      const date = dateKeyToDate(dateKey);
      const serverNow = now();
      const { restDay, mascot } = await db.$transaction(async (tx) => {
        const { hoje, restDays } = await lerDiaDoDescanso(tx, c.var.user, dateKey, serverNow);
        const validado = validarDescanso(dateKey, hoje, restDays);
        if (!validado.ok) throw recusa(validado.error);
        // INSERT ... ON CONFLICT DO NOTHING: repetir é idempotente.
        await tx.restDay.createMany({ data: [{ userId, date }], skipDuplicates: true });
        return { restDay: { date: dateKey }, mascot: await refreshMascot(tx, userId, metadata.timezone, serverNow) };
      });
      const newAchievements = await unlockAchievements(db, c.var.user, serverNow);
      return c.json({ restDay, mascot, newAchievements });
    })
    .delete('/:date', pathParams(dateParamSchema), async (c) => {
      const { id: userId, metadata } = c.var.user;
      const dateKey = c.req.valid('param').date;
      const serverNow = now();
      // Acerta antes de apagar: o gelo vê os dias como estavam.
      await acertarGeloDaPessoa(db, c.var.user, serverNow);
      const { deleted, mascot } = await db.$transaction(async (tx) => {
        const { hoje } = await lerDiaDoDescanso(tx, c.var.user, dateKey, serverNow);
        const validado = validarDiaDoDescanso(dateKey, hoje);
        if (!validado.ok) throw recusa(validado.error);
        const { count } = await tx.restDay.deleteMany({ where: { userId, date: dateKeyToDate(dateKey) } });
        return { deleted: count, mascot: await refreshMascot(tx, userId, metadata.timezone, serverNow) };
      });
      return c.json({ deleted, mascot });
    });
}

/** O "hoje" da pessoa para o pedido e os descansos em volta (a semana dele cabe aí). Duas leituras fixas. */
async function lerDiaDoDescanso(tx: Client, person: SessionUser, date: DateKey, now: number) {
  const { id: userId, metadata } = person;
  const doApp = dateKeyOf(now, metadata.timezone);
  const habito = await tx.habitLog.findFirst({ where: { userId, date: dateKeyToDate(doApp) }, select: { date: true } });
  const rows = await tx.restDay.findMany({
    where: { userId, date: { gte: dateKeyToDate(addDays(date, -7)), lte: dateKeyToDate(addDays(date, 7)) } },
    select: restDaySelect,
  });
  const restDays = rows.map(restDayMapper.toDomain);
  const hoje = hojeDoDescanso({
    date,
    dated: [...(habito ? [doApp] : []), ...restDays.map((r) => r.date)],
    timeZone: metadata.timezone,
    dayStartMinutes: metadata.profile?.dayStartMinutes,
    now,
  });
  return { hoje, restDays };
}

function recusa({ code, message }: { code: RestErrorCode; message: string }): ApiError {
  return new ApiError(code === 'descanso_so_hoje' ? 400 : 409, code, message);
}
