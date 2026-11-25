import { MINUTE_MS } from './clock';
import { focusedMs } from './joias';
import type { FocusSession, ProfileStats, Repository } from './types';

export interface StatsInput {
  habitosFeitos: number;
  sessions: readonly FocusSession[];
  desde: number;
}

/** Números de todo o tempo do Perfil. Minutos inteiros de foco, somando as sessões terminadas (também as interrompidas). */
export function computeStats({ habitosFeitos, sessions, desde }: StatsInput): ProfileStats {
  const ms = sessions.reduce((total, session) => total + focusedMs(session), 0);
  return { habitosFeitos, minutosDeFoco: Math.floor(ms / MINUTE_MS), desde };
}

/** Repositório que já recebe as estatísticas prontas (o remoto: o servidor enxerga todo o histórico). */
export interface StatsSource {
  getStats(): Promise<ProfileStats>;
}

export function providesStats(repo: Repository): repo is Repository & StatsSource {
  return 'getStats' in repo && typeof repo.getStats === 'function';
}

/** As estatísticas de um repositório: as do servidor, quando ele as fornece; senão (demo, memória), calculadas dos registros. */
export async function verEstatisticas(repo: Repository): Promise<ProfileStats | null> {
  if (providesStats(repo)) return repo.getStats();
  const [user, habitLogs, sessions] = await Promise.all([repo.getUser(), repo.listHabitLogs(), repo.listSessions()]);
  if (!user) return null;
  return computeStats({ habitosFeitos: habitLogs.length, sessions, desde: user.createdAt });
}
