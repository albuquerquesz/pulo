import type { RemoteRepository } from '@pulo/client';
import type { Preferences, Repository } from '@pulo/core/domain/types';
import { DEFAULT_PREFERENCES } from '@pulo/core/domain/user-metadata';

/**
 * O que o remoto oferece além do `Repository` do core. As telas perguntam pela capacidade,
 * nunca por qual repositório está em uso.
 */
export type FonteDePreferencias = Pick<RemoteRepository, 'getPreferences' | 'savePreferences'>;
/** Ações de conta: exportar, aplicativos conectados e excluir. */
export type FonteDaConta = Pick<RemoteRepository, 'exportData' | 'listConnections' | 'disconnect' | 'deleteAccount'>;
export type AvisosDeConquista = Pick<RemoteRepository, 'onNewAchievements'>;
/** Todos os dias protegidos por gelo, quando quem os guarda é o servidor. */
export type FonteDasDatasDoGelo = Pick<RemoteRepository, 'getFreezeDates'>;

export function temPreferencias(repo: Repository): repo is Repository & FonteDePreferencias {
  return 'getPreferences' in repo && 'savePreferences' in repo;
}

export function temConta(repo: Repository): repo is Repository & FonteDaConta {
  return 'exportData' in repo && 'listConnections' in repo && 'disconnect' in repo && 'deleteAccount' in repo;
}

export function temAvisosDeConquista(repo: Repository): repo is Repository & AvisosDeConquista {
  return 'onNewAchievements' in repo;
}

export function temDatasDoGelo(repo: Repository): repo is Repository & FonteDasDatasDoGelo {
  return 'getFreezeDates' in repo;
}

/** Reler tudo do servidor (só o remoto tem o que reler). */
export type FonteComRecarga = Pick<RemoteRepository, 'reload'>;

export function temRecarga(repo: Repository): repo is Repository & FonteComRecarga {
  return 'reload' in repo;
}

/** As preferências da conta; os padrões onde o repositório não as guarda. */
export async function verPreferencias(repo: Repository): Promise<Preferences> {
  return temPreferencias(repo) ? repo.getPreferences() : DEFAULT_PREFERENCES;
}
