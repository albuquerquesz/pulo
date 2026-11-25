import { createMemoryRepository } from '@/data';
import { createDemoClock, localToMs, seedRepository, type DemoClock } from '@pulo/core/demo';
import type { Repository } from '@pulo/core/domain/types';

import { completarDemo, DIA_DO_DEMO, MINUTOS_DO_DEMO } from './demoDoRascunho';
import type { PessoaLogada } from '../sessao/auth';

/** A pessoa de exemplo que a casca mostra no demo (a do rascunho). */
export const PESSOA_DO_DEMO: PessoaLogada = { id: 'demo-user', nome: 'Ana', email: 'ana@exemplo.com' };

export interface SessaoDemo {
  repo: Repository;
  clock: DemoClock;
}

/** Ponto único do modo demo: repositório em memória com dados sintéticos e o relógio do demo. */
export async function criarSessaoDemo(): Promise<SessaoDemo> {
  const clock = createDemoClock(localToMs(DIA_DO_DEMO, MINUTOS_DO_DEMO));
  const repo = createMemoryRepository();
  await seedRepository(repo, clock);
  await completarDemo(repo, clock);
  return { repo, clock };
}
