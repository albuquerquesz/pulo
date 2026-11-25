import type { FontesDeJoias } from '@pulo/core/domain/joias';
import { focusSessionMapper, goalMapper, habitLogMapper, restDayMapper } from '@pulo/db';
import type { Client } from './http';
import { goalSelect, habitLogSelect, restDaySelect, sessionSelect } from './selects';

/** Tudo o que gera joias, de todo o histórico. Cinco leituras fixas, numa transação de quem chama. */
export async function lerFontesDeJoias(tx: Client, userId: string): Promise<FontesDeJoias> {
  const where = { userId };
  const habitLogs = await tx.habitLog.findMany({ where, select: habitLogSelect });
  const sessions = await tx.focusSession.findMany({ where, select: sessionSelect });
  const restDays = await tx.restDay.findMany({ where, select: restDaySelect });
  const goals = await tx.goal.findMany({ where, select: goalSelect });
  const credito = await tx.joiaCredit.findUnique({ where, select: { amount: true } });
  return {
    habitLogs: habitLogs.map(habitLogMapper.toDomain),
    sessions: sessions.map(focusSessionMapper.toDomain),
    restDays: restDays.map(restDayMapper.toDomain),
    goals: goals.map(goalMapper.toDomain),
    credito: credito?.amount ?? 0,
  };
}
