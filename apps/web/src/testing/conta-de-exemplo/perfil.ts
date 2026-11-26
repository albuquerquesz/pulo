import type { McpConnection } from '@pulo/core/api/schemas';
import { ACHIEVEMENTS, DEFAULT_TIMEZONE } from '@pulo/core/config/decisions';
import { type AchievementSource, verConquistas } from '@pulo/core/domain/achievements';
import { dateKeyOf } from '@pulo/core/domain/day';
import { acertarGeloLocal } from '@pulo/core/domain/gelo';
import { listFreezeDatesOf } from '@pulo/core/domain/gelo-store';
import { computeStats, type StatsSource } from '@pulo/core/domain/stats';
import { computeStreak, type StreakSource } from '@pulo/core/domain/streak';
import type { Achievement, AchievementId, ProfileStats, Repository } from '@pulo/core/domain/types';
import { applyUserMetadataPatch, DEFAULT_USER_METADATA, preferencesFromMetadata, type UserMetadata } from '@pulo/core/domain/user-metadata';

import type { FonteDaConta, FonteDePreferencias } from '../../features/app/conta';
import { localToMs, type RelogioDeExemplo } from '@pulo/core/testing/relogio';

/** Os números do Perfil no rascunho. O que o teste fizer soma em cima. */
const NUMEROS = { habitosFeitos: 186, minutosDeFoco: 1240, desde: '2026-09-14', recorde: 21 };
const LEMBRETE_DA_NOITE = 20 * 60;

/** As conquistas que o rascunho mostra além do que o app calcula: data (se houver) ou quanto já andou. */
const CONQUISTAS: Partial<Record<AchievementId, { em?: string; progresso?: number }>> = {
  'primeira-semana': { em: '2026-10-02' },
  'foco-profundo': { em: '2026-10-18' },
  'descanso-sabido': { em: '2026-11-08' },
  'mes-de-fogo': { progresso: NUMEROS.recorde },
};

const meioDia = (data: string) => localToMs(data, 12 * 60);

function conquistaDeExemplo(calculada: Achievement): Achievement {
  const exemplo = CONQUISTAS[calculada.id];
  const catalogo = ACHIEVEMENTS.find((c) => c.id === calculada.id);
  if (!exemplo || !catalogo) return calculada;
  if (exemplo.em === undefined) return { ...calculada, progresso: exemplo.progresso ?? calculada.progresso };
  const { id, nome, emoji, meta } = catalogo;
  return { id, nome, emoji, meta, progresso: meta, conquistada: true, conquistadaEm: meioDia(exemplo.em) };
}

const CLAUDE: McpConnection = {
  clientId: 'ex-claude',
  name: 'Claude',
  scopes: ['pulo'],
  connectedAt: meioDia('2026-11-02'),
  updatedAt: meioDia('2026-11-20'),
};

export type RepositorioDeExemplo = Repository & FonteDePreferencias & FonteDaConta & StatsSource & StreakSource & AchievementSource;

/**
 * Preferências, conta, estatísticas e conquistas em memória, com os exemplos do rascunho.
 * Nada daqui fala com um servidor.
 */
export async function comContaDeExemplo<R extends Repository>(repo: R, clock: RelogioDeExemplo): Promise<R & RepositorioDeExemplo> {
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
      // O gelo devido é gasto antes de contar a sequência, como o servidor faz.
      await acertarGeloLocal(repo, clock);
      const freezes = await listFreezeDatesOf(repo);
      const [user, habitLogs, sessions, restDays] = await Promise.all([repo.getUser(), repo.listHabitLogs(), repo.listSessions(), repo.listRestDays()]);
      const sequencia = computeStreak({
        habitLogs,
        sessions,
        restDays,
        freezes,
        vacation: metadata.vacation,
        timeZone: user?.timezone ?? DEFAULT_TIMEZONE,
        dayStartMinutes: user?.dayStartMinutes,
        now: clock.now(),
      });
      return { ...sequencia, recorde: Math.max(sequencia.recorde, NUMEROS.recorde) };
    },
    getAchievements: async () => (await verConquistas(repo, clock)).map(conquistaDeExemplo),
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
      return { exemplo: true, exportadoEm, user, preferences: preferencesFromMetadata(metadata), habits, habitLogs, sessions, restDays, goals, tasks, housePurchases };
    },
    listConnections: async () => [...conexoes],
    disconnect: async (clientId) => {
      conexoes = conexoes.filter((c) => c.clientId !== clientId);
    },
    deleteAccount: () => repo.clearAll(),
  };
}
