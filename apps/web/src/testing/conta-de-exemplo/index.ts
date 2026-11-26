import { createMemoryRepository } from '@/data';
import type { ParteId } from '@pulo/core/domain/casa';
import type { Repository } from '@pulo/core/domain/types';

import { comHistoricoDosHabitos } from './habitos';
import { comContaDeExemplo } from './perfil';
import { gravarQuatroSemanas } from '@pulo/core/testing/quatro-semanas';
import { criarRelogio, localToMs, type RelogioDeExemplo } from '@pulo/core/testing/relogio';
import { CASA_DE_EXEMPLO, completarConta, custoDaCasa, DIA_DE_EXEMPLO, MINUTOS_DE_EXEMPLO } from './rascunho';

export interface ContaDeExemplo {
  repo: Repository;
  clock: RelogioDeExemplo;
}

export interface OpcoesDaConta {
  /** As partes que a casa de exemplo já tem; o padrão é a casa pela metade. */
  casa?: readonly ParteId[];
  /** O relógio segue o tempo do teste, para o foco andar na tela; sem isto fica parado no instante do rascunho. */
  aoVivo?: boolean;
}

/** O relógio parte do instante do rascunho e anda junto com `Date.now()`. */
function relogioCorrendo(base: RelogioDeExemplo): RelogioDeExemplo {
  const abertura = Date.now();
  return { ...base, now: () => base.now() + (Date.now() - abertura) };
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

/** Só para testes: uma conta com dados sintéticos em memória e o relógio parado no instante do rascunho. */
export async function criarContaDeExemplo({ casa = CASA_DE_EXEMPLO, aoVivo = false }: OpcoesDaConta = {}): Promise<ContaDeExemplo> {
  const parado = criarRelogio(localToMs(DIA_DE_EXEMPLO, MINUTOS_DE_EXEMPLO));
  const clock = aoVivo ? relogioCorrendo(parado) : parado;
  const repo = createMemoryRepository(undefined, clock);
  await gravarQuatroSemanas(repo, clock);
  await completarConta(repo, clock, casa);
  return { repo: await comContaDeExemplo(comHistoricoDosHabitos(comCreditoDaCasa(repo, custoDaCasa(casa)), clock), clock), clock };
}
