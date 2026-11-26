import type { FreezePurchaseList } from './joias';
import type { DateKey, FreezeUse, Purchase, Repository } from './types';

/**
 * Onde um repositório local (memória, armazenamento) guarda o gelo. O remoto não implementa: quem grava e acerta
 * o gelo da conta é o servidor.
 */
export interface FreezeStore extends FreezePurchaseList {
  saveFreezePurchase(purchase: Purchase): Promise<void>;
  listFreezeUses(): Promise<FreezeUse[]>;
  /** Cria ou atualiza, um por dia. */
  saveFreezeUses(uses: readonly FreezeUse[]): Promise<void>;
  /** Último dia lógico já resolvido; `null` se o gelo nunca foi acertado. */
  getFreezeResolvedUntil(): Promise<DateKey | null>;
  saveFreezeResolvedUntil(date: DateKey): Promise<void>;
}

export function providesFreezeStore(repo: Repository): repo is Repository & FreezeStore {
  return 'listFreezeUses' in repo && typeof repo.listFreezeUses === 'function';
}

/** Os dias protegidos de um repositório local; vazio quando ele não os guarda. */
export async function listFreezeDatesOf(repo: Repository): Promise<DateKey[]> {
  return providesFreezeStore(repo) ? (await repo.listFreezeUses()).map((use) => use.date) : [];
}
