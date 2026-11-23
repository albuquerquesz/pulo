import type { DateRangeQuery } from '@pulo/core/api/schemas';
import { addDays, startOfLogicalDay } from '@pulo/core/domain/day';
import type { MascotState } from '@pulo/core/domain/types';
import { computeMascotState } from '@pulo/core/domain/phase';
import { type Prisma, dateKeyToDate, focusSessionMapper, mascotStateMapper, restDayMapper } from '@pulo/db';
import type { Client } from './http';
import { mascotSelect, restDaySelect, sessionSelect } from './selects';

/** Filtro de uma coluna `date` por intervalo de DateKey (extremos incluídos); sem extremos, sem filtro. */
export function dateFilter(range: DateRangeQuery): { gte?: Date; lte?: Date } | undefined {
  if (range.from === undefined && range.to === undefined) return undefined;
  return {
    ...(range.from === undefined ? {} : { gte: dateKeyToDate(range.from) }),
    ...(range.to === undefined ? {} : { lte: dateKeyToDate(range.to) }),
  };
}

/**
 * Sessões do intervalo: as que terminaram dentro dos dias lógicos (no fuso da pessoa) mais a que está em andamento,
 * sempre, para o app reencontrar o foco aberto. Uma query, sem filtro por item.
 */
export function sessionRangeWhere(userId: string, range: DateRangeQuery, timeZone: string): Prisma.FocusSessionWhereInput {
  const gte = range.from === undefined ? undefined : new Date(startOfLogicalDay(range.from, timeZone));
  const lt = range.to === undefined ? undefined : new Date(startOfLogicalDay(addDays(range.to, 1), timeZone));
  if (gte === undefined && lt === undefined) return { userId };
  return {
    userId,
    OR: [{ endedAt: { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) } }, { state: 'em_andamento' }],
  };
}

export async function readMascot(client: Client, userId: string): Promise<MascotState | null> {
  const row = await client.mascotState.findUnique({ where: { userId }, select: mascotSelect });
  return row === null ? null : mascotStateMapper.toDomain(row);
}

/**
 * Recalcula o estado do sapo com a lógica do core (a fase nunca regride) e grava em `mascot_state`.
 * Chame quando uma escrita pode mudar os dias de cuidado. Quatro queries fixas: sessões encerradas, dias de descanso,
 * estado anterior e o upsert (as leituras não crescem em número com os dados).
 */
export async function refreshMascot(client: Client, userId: string, timeZone: string, now: number): Promise<MascotState> {
  const sessions = await client.focusSession.findMany({
    where: { userId, state: { not: 'em_andamento' } },
    select: sessionSelect,
  });
  const restDays = await client.restDay.findMany({ where: { userId }, select: restDaySelect });
  const previous = await readMascot(client, userId);
  const state = computeMascotState(
    sessions.map(focusSessionMapper.toDomain),
    restDays.map(restDayMapper.toDomain),
    timeZone,
    previous,
    now,
  );
  const row = mascotStateMapper.fromDomain(userId, state);
  await client.mascotState.upsert({
    where: { userId },
    create: row,
    update: { phase: row.phase, careDays: row.careDays, updatedAt: row.updatedAt },
  });
  return state;
}
