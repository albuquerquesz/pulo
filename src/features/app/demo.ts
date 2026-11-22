import { createMemoryRepository } from '@/data';
import { createDemoClock, seedRepository, type DemoClock } from '@/demo';
import type { Repository } from '@/domain/types';

export interface SessaoDemo {
  repo: Repository;
  clock: DemoClock;
}

/** Ponto único do modo demo: repositório em memória com dados sintéticos e o relógio do demo. */
export async function criarSessaoDemo(): Promise<SessaoDemo> {
  const clock = createDemoClock();
  const repo = createMemoryRepository();
  await seedRepository(repo, clock);
  return { repo, clock };
}
