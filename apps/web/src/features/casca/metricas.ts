import { MINUTE_MS } from '@pulo/core/domain/clock';
import { verMetricas } from '@pulo/core/domain/metricas';
import type { Clock, ProfileMetrics, Repository } from '@pulo/core/domain/types';

/** Por quanto tempo uma resposta das métricas serve de novo, sem nenhuma escrita no meio. */
const VALIDADE_MS = MINUTE_MS;

interface Guardada {
  versao: number;
  em: number;
  metricas: Promise<ProfileMetrics>;
}

const guardadas = new WeakMap<Repository, Guardada>();

async function pedir(repo: Repository, clock: Clock): Promise<ProfileMetrics> {
  const metricas = await verMetricas(repo, clock);
  if (!metricas) throw new Error('sem usuário');
  return metricas;
}

/**
 * As métricas com cache curto, para o Perfil não pedir duas vezes.
 * `versao` é a do app: depois de uma escrita (`refresh`) a resposta antiga não vale.
 */
export function carregarMetricas(repo: Repository, clock: Clock, versao: number): Promise<ProfileMetrics> {
  const agora = clock.now();
  const atual = guardadas.get(repo);
  if (atual && atual.versao === versao && agora - atual.em < VALIDADE_MS) return atual.metricas;
  const metricas = pedir(repo, clock);
  guardadas.set(repo, { versao, em: agora, metricas });
  // Uma falha não fica guardada.
  metricas.catch(() => guardadas.delete(repo));
  return metricas;
}
