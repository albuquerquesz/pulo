// Dados sintéticos só para os testes das propostas: uma semana (2026-11-16 a 2026-11-22, São Paulo) em que a manhã
// rendeu menos que a tarde, o que gera UMA candidata `mover_foco` (o bloco da manhã vai para a tarde).
import type { Db } from '@pulo/db';

export const WEEK = '2026-11-16';
export const TITLES = ['Escrever a tese secreta', 'Estudar o projeto Zeta'] as const;
export const MORNING_BLOCK = 'bloco-manha';
export const AFTERNOON_BLOCK = 'bloco-tarde';

const MIN = 60_000;
const day = (n: number) => new Date(Date.UTC(2026, 10, 16 + n));
const at = (n: number, hourUtc: number) => new Date(Date.UTC(2026, 10, 16 + n, hourUtc));

/**
 * Semana com dados suficientes e dois blocos de foco (manhã e tarde). `extra` acrescenta linhas que não mudam o resultado
 * (sessões e check ins à noite e à tarde, blocos de descanso no domingo) para provar que o número de queries não cresce.
 */
export async function seedProposalWeek(db: Db, userId: string, extra = 0) {
  await db.routineBlock.createMany({
    data: [
      { id: `${MORNING_BLOCK}-${userId}`, userId, weekday: 1, startMinutes: 540, durationMinutes: 50, kind: 'foco', title: TITLES[0] },
      { id: `${AFTERNOON_BLOCK}-${userId}`, userId, weekday: 2, startMinutes: 840, durationMinutes: 50, kind: 'foco', title: TITLES[1] },
      ...Array.from({ length: extra }, (_, i) => ({
        id: `descanso-${i}-${userId}`,
        userId,
        weekday: 6,
        startMinutes: i * 25,
        durationMinutes: 10,
        kind: 'descanso' as const,
        title: `Pausa ${i}`,
      })),
    ],
  });
  const session = (n: number, hourUtc: number, state: 'concluida' | 'interrompida') => ({
    userId,
    startedAt: new Date(at(n, hourUtc).getTime() - 25 * MIN),
    endedAt: at(n, hourUtc),
    plannedMinutes: 25,
    state,
  });
  await db.focusSession.createMany({
    data: [
      // Tarde (15h em São Paulo): tudo concluído. Manhã (10h): um concluído e dois interrompidos.
      session(0, 18, 'concluida'), session(1, 18, 'concluida'), session(2, 18, 'concluida'),
      session(0, 13, 'concluida'), session(1, 13, 'interrompida'), session(2, 13, 'interrompida'),
      // Noite (19h): linhas extras para medir que o número de queries não cresce.
      ...Array.from({ length: extra }, (_, i) => session(i % 7, 22, 'concluida')),
    ],
  });
}
