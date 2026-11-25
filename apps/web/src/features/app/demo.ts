import { createMemoryRepository } from '@/data';
import { createDemoClock, localToMs, seedRepository, type DemoClock } from '@pulo/core/demo';
import type { ParteId } from '@pulo/core/domain/casa';
import type { Repository } from '@pulo/core/domain/types';

import { CASA_DO_DEMO, completarDemo, custoDaCasa, DIA_DO_DEMO, MINUTOS_DO_DEMO } from './demoDoRascunho';
import { comHistoricoDosHabitos } from './demoDosHabitos';
import { comContaDoDemo } from './demoDoPerfil';
import type { PessoaLogada } from '../sessao/auth';

/** A pessoa de exemplo que a casca mostra no demo (a do rascunho). */
export const PESSOA_DO_DEMO: PessoaLogada = { id: 'demo-user', nome: 'Ana', email: 'ana@exemplo.com' };

export interface SessaoDemo {
  repo: Repository;
  clock: DemoClock;
}

/** O relógio parte do instante do rascunho e segue o tempo real, para o foco andar na tela. */
function relogioCorrendo(base: DemoClock): DemoClock {
  const abertura = Date.now();
  return { ...base, now: () => base.now() + (Date.now() - abertura) };
}

export interface OpcoesDoDemo {
  /** O relógio anda (no app); sem isto fica parado no instante do rascunho (testes). */
  aoVivo?: boolean;
  /** As partes que a casa de exemplo já tem; o padrão é a casa pela metade. */
  casa?: readonly ParteId[];
}

/** O crédito paga a casa de exemplo, sem mexer no saldo que o rascunho mostra. Apagar tudo zera. */
function comCreditoDaCasa(repo: Repository, custo: number): Repository {
  let credito = custo;
  return {
    ...repo,
    getJoiaCredit: async () => credito,
    clearAll: async () => {
      await repo.clearAll();
      credito = 0;
    },
  };
}

/** Ponto único do modo demo: repositório em memória com dados sintéticos e o relógio do demo. */
export async function criarSessaoDemo({ aoVivo = false, casa = CASA_DO_DEMO }: OpcoesDoDemo = {}): Promise<SessaoDemo> {
  const parado = createDemoClock(localToMs(DIA_DO_DEMO, MINUTOS_DO_DEMO));
  const clock = aoVivo ? relogioCorrendo(parado) : parado;
  const repo = createMemoryRepository(undefined, clock);
  await seedRepository(repo, clock);
  await completarDemo(repo, clock, casa);
  return { repo: await comContaDoDemo(comHistoricoDosHabitos(comCreditoDaCasa(repo, custoDaCasa(casa)), clock), clock), clock };
}
