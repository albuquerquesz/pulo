import { createRepository, emptyDatabase, type Database } from './repository-core';
import type { FreezeStore } from '../domain/gelo-store';
import type { Repository } from '../domain/types';

/** Chave e valor, só texto. Qualquer coisa que guarde string serve. */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const STORAGE_KEY = 'pulo:v1:db';

export function createMemoryAdapter(initial: Record<string, string> = {}): StorageAdapter {
  const map = new Map(Object.entries(initial));
  return {
    getItem: async (key) => map.get(key) ?? null,
    setItem: async (key, value) => void map.set(key, value),
    removeItem: async (key) => void map.delete(key),
  };
}

/** Adaptador de localStorage (web). Devolve null se não houver ou estiver bloqueado. */
export function createLocalStorageAdapter(): StorageAdapter | null {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    if (!ls) return null;
    const probe = '__pulo_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return {
      getItem: async (key) => ls.getItem(key),
      setItem: async (key, value) => void ls.setItem(key, value),
      removeItem: async (key) => void ls.removeItem(key),
    };
  } catch {
    return null;
  }
}

/** localStorage se existir, senão memória. Para nativo, ver async-storage-adapter.ts. */
export function createDefaultAdapter(): StorageAdapter {
  return createLocalStorageAdapter() ?? createMemoryAdapter();
}

function parse(raw: string | null): Database {
  if (!raw) return emptyDatabase();
  try {
    const data = JSON.parse(raw) as Partial<Database>;
    if (!data || typeof data !== 'object' || data.version !== 1) return emptyDatabase();
    return { ...emptyDatabase(), ...data };
  } catch {
    return emptyDatabase();
  }
}

/** Repositório persistente: o banco inteiro vira um JSON numa chave. */
export function createStorageRepository(adapter: StorageAdapter = createDefaultAdapter(), key = STORAGE_KEY): Repository & FreezeStore {
  return createRepository({
    load: async () => parse(await adapter.getItem(key)),
    commit: async (db) => adapter.setItem(key, JSON.stringify(db)),
  });
}
