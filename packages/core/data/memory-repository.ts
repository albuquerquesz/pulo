import { clone, createRepository, emptyDatabase, type Database } from './repository-core';
import type { Clock, Repository } from '../domain/types';

/** Repositório em memória (testes, modo demo, fallback). `initial` é copiado. */
export function createMemoryRepository(initial?: Partial<Database>, clock?: Clock): Repository {
  let db: Database = { ...emptyDatabase(), ...clone(initial ?? {}) };
  return createRepository(
    {
      load: async () => db,
      commit: async (next) => {
        db = next;
      },
    },
    clock,
  );
}
