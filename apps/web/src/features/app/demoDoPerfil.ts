import type { McpConnection } from '@pulo/core/api/schemas';
import { ACHIEVEMENTS, DEFAULT_TIMEZONE } from '@pulo/core/config/decisions';
import { localToMs, type DemoClock } from '@pulo/core/demo';
import { type AchievementSource, verConquistas } from '@pulo/core/domain/achievements';
import { dateKeyOf } from '@pulo/core/domain/day';
import { computeStats, type StatsSource } from '@pulo/core/domain/stats';
import { computeStreak, type StreakSource } from '@pulo/core/domain/streak';
import type { Achievement, AchievementId, ProfileStats, Repository } from '@pulo/core/domain/types';
import { applyUserMetadataPatch, DEFAULT_USER_METADATA, preferencesFromMetadata, type UserMetadata } from '@pulo/core/domain/user-metadata';

import type { FonteDaConta, FonteDePreferencias } from './conta';

/** Os números do Perfil no rascunho. O que a pessoa fizer no demo soma em cima. */
const NUMEROS = { habitosFeitos: 186, minutosDeFoco: 1240, desde: '2026-09-14', recorde: 21 };
const LEMBRETE_DA_NOITE = 20 * 60;

/** As conquistas que o rascunho mostra além do que o demo calcula: data (se houver) ou quanto já andou. */
const CONQUISTAS: Partial<Record<AchievementId, { em?: string; progresso?: number }>> = {
  'primeira-semana': { em: '2026-10-02' },
  'foco-profundo': { em: '2026-10-18' },
  'descanso-sabido': { em: '2026-11-08' },
  'mes-de-fogo': { progresso: NUMEROS.recorde },
};

const meioDia = (data: string) => localToMs(data, 12 * 60);

function conquistaDoDemo(calculada: Achievement): Achievement {
  const exemplo = CONQUISTAS[calculada.id];
  const catalogo = ACHIEVEMENTS.find((c) => c.id === calculada.id);
  if (!exemplo || !catalogo) return calculada;
  if (exemplo.em === undefined) return { ...calculada, progresso: exemplo.progresso ?? calculada.progresso };
  const { id, nome, emoji, meta } = catalogo;
  return { id, nome, emoji, meta, progresso: meta, conquistada: true, conquistadaEm: meioDia(exemplo.em) };
}

const CLAUDE: McpConnection = {
  clientId: 'demo-claude',
  name: 'Claude',
  scopes: ['pulo'],
  connectedAt: meioDia('2026-11-02'),
  updatedAt: meioDia('2026-11-20'),
};

export type RepositorioDoDemo = Repository & FonteDePreferencias & FonteDaConta & StatsSource & StreakSource & AchievementSource;

/**
 * Só no demo: preferências, conta, estatísticas e conquistas em memória, com os exemplos do rascunho.
 * Nada daqui fala com um servidor.
 */
export async function comContaDoDemo<R extends Repository>(repo: R, clock: DemoClock): Promise<R & RepositorioDoDemo> {
  let metadata: UserMetadata = { ...DEFAULT_USER_METADATA, eveningReminder: { ligado: true, minutos: LEMBRETE_DA_NOITE } };
  let conexoes = [CLAUDE];

  const calcular = async (): Promise<ProfileStats> => {
    const [logs, sessions] = await Promise.all([repo.listHabitLogs(), repo.listSessions()]);
    return computeStats({ habitosFeitos: logs.length, sessions, desde: meioDia(NUMEROS.desde) });
  };
  const inicial = await calcular();

  return {
    ...repo,
    getPreferences: async () => preferencesFromMetadata(metadata),
    savePreferences: async (patch) => {
      metadata = applyUserMetadataPatch(metadata, patch, clock.now());
    },
    getStats: async () => {
      const agora = await calcular();
      return {
        ...agora,
        habitosFeitos: NUMEROS.habitosFeitos + agora.habitosFeitos - inicial.habitosFeitos,
        minutosDeFoco: NUMEROS.minutosDeFoco + agora.minutosDeFoco - inicial.minutosDeFoco,
      };
    },
    getStreak: async () => {
      const [user, habitLogs, sessions, restDays] = await Promise.all([repo.getUser(), repo.listHabitLogs(), repo.listSessions(), repo.listRestDays()]);
      const sequencia = computeStreak({
        habitLogs,
        sessions,
        restDays,
        vacation: metadata.vacation,
        timeZone: user?.timezone ?? DEFAULT_TIMEZONE,
        dayStartMinutes: user?.dayStartMinutes,
        now: clock.now(),
      });
      return { ...sequencia, recorde: Math.max(sequencia.recorde, NUMEROS.recorde) };
    },
    getAchievements: async () => (await verConquistas(repo, clock)).map(conquistaDoDemo),
    exportData: async () => {
      const [user, habits, habitLogs, sessions, restDays, goals, tasks, housePurchases] = await Promise.all([
        repo.getUser(),
        repo.listHabits(),
        repo.listHabitLogs(),
        repo.listSessions(),
        repo.listRestDays(),
        repo.listGoals(),
        repo.listTasks(),
        repo.listHousePurchases(),
      ]);
      const exportadoEm = dateKeyOf(clock.now(), user?.timezone ?? DEFAULT_TIMEZONE);
      return { demo: true, exportadoEm, user, preferences: preferencesFromMetadata(metadata), habits, habitLogs, sessions, restDays, goals, tasks, housePurchases };
    },
    listConnections: async () => [...conexoes],
    disconnect: async (clientId) => {
      conexoes = conexoes.filter((c) => c.clientId !== clientId);
    },
    deleteAccount: () => repo.clearAll(),
  };
}
