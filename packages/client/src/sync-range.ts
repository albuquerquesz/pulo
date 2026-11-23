import { DEFAULT_TIMEZONE } from '@pulo/core/config/decisions';
import { SYNC_MAX_DAYS } from '@pulo/core/api/schemas';
import { addDays, dateKeyOf } from '@pulo/core/domain/day';
import type { DateRange } from '@pulo/core/domain/types';

/**
 * Janela do `GET /api/sync` na abertura: os últimos 180 dias e 2 dias à frente.
 * Cobre a semana atual, as semanas que a IA e a tela Semana olham (4 a 8) e a sequência de cuidado recente,
 * com folga para o fuso. Blocos, hábitos e propostas vêm inteiros; só registros por data (hábitos feitos,
 * check ins, descansos) e sessões respeitam a janela. O limite do servidor é `SYNC_MAX_DAYS` (400).
 * O estado do sapo vem do servidor, que calcula sobre todo o histórico.
 */
export const DEFAULT_HISTORY_DAYS = 180;
const DAYS_AHEAD = 2;

export function syncRange(now: number, historyDays = DEFAULT_HISTORY_DAYS, timeZone = DEFAULT_TIMEZONE): DateRange {
  const days = Math.min(Math.max(1, Math.floor(historyDays)), SYNC_MAX_DAYS - DAYS_AHEAD);
  const today = dateKeyOf(now, timeZone);
  return { from: addDays(today, -days), to: addDays(today, DAYS_AHEAD) };
}
