import { DEFAULT_TIMEZONE, HABITS } from '@pulo/core/config/decisions';
import { addDays, dateKeyOf, weekdayOf } from '@pulo/core/domain/day';
import { computeHabitStats, type HabitStatsSource } from '@pulo/core/domain/habit-stats';
import type { Clock, DateKey, EntityId, Habit, Repository } from '@pulo/core/domain/types';

/** Quantos dias seguidos o hábito vem fazendo e a fração dos outros dias cumpridos (os números do rascunho). */
interface Exemplo {
  sequencia: number;
  taxa: number;
}

const EXEMPLOS: Record<EntityId, Exemplo> = {
  'demo-habito-agua': { sequencia: 23, taxa: 0.92 },
  'demo-habito-alongar': { sequencia: 12, taxa: 0.84 },
  'demo-habito-caminhar': { sequencia: 5, taxa: 0.78 },
  'demo-habito-ingles': { sequencia: 8, taxa: 0.86 },
  'demo-habito-ler': { sequencia: 3, taxa: 0.64 },
};

/** Número de 0 a 1 que se repete para o mesmo hábito e dia. */
function sorteio(id: string, dia: number): number {
  let h = dia + 13;
  for (const letra of id) h = (h * 31 + letra.charCodeAt(0)) % 233280;
  return ((h * 9301 + 49297) % 233280) / 233280;
}

/** Os dias feitos de exemplo, de ontem para trás, em todo o calendário. */
export function diasDeExemplo(habito: Pick<Habit, 'id' | 'weekdays'>, hoje: DateKey): DateKey[] {
  const exemplo = EXEMPLOS[habito.id];
  if (!exemplo) return [];
  const dias: DateKey[] = [];
  let esperados = 0;
  for (let atras = 1; atras < HABITS.statsWeeks * 7; atras += 1) {
    const date = addDays(hoje, -atras);
    if (!habito.weekdays.includes(weekdayOf(date))) continue;
    esperados += 1;
    const naSequencia = esperados <= exemplo.sequencia;
    // O dia logo antes da sequência fica vazio, para ela ter o tamanho do exemplo.
    const quebra = esperados === exemplo.sequencia + 1;
    if (naSequencia || (!quebra && sorteio(habito.id, atras) < exemplo.taxa)) dias.push(date);
  }
  return dias;
}

/**
 * Só no demo: as estatísticas contam um passado inventado. Ele não é gravado como registro, para não mudar
 * o saldo de joias nem a sequência geral do rascunho.
 */
export function comHistoricoDosHabitos(repo: Repository, clock: Clock): Repository & HabitStatsSource {
  return {
    ...repo,
    async getHabitStats(id) {
      const [habitos, logs, restDays, user] = await Promise.all([
        repo.listHabits(),
        repo.listHabitLogs(),
        repo.listRestDays(),
        repo.getUser(),
      ]);
      const habito = habitos.find((h) => h.id === id);
      if (!habito) throw new Error('Hábito não encontrado.');
      const timeZone = user?.timezone ?? DEFAULT_TIMEZONE;
      const hoje = dateKeyOf(clock.now(), timeZone);
      const exemplos = diasDeExemplo(habito, hoje).map((date) => ({ date }));
      return computeHabitStats({
        habito,
        logs: [...logs.filter((log) => log.habitId === id), ...exemplos],
        restDays,
        timeZone,
        dayStartMinutes: user?.dayStartMinutes,
        now: clock.now(),
      });
    },
  };
}
