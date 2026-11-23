import type { User } from '../domain/types';
import { createMemoryRepository } from './memory-repository';
import { defineRepositoryContract } from './repository-contract';
import { createMemoryAdapter, createStorageRepository, STORAGE_KEY } from './storage';

const user: User = {
  id: 'u1',
  frogName: 'Pulo',
  timezone: 'America/Sao_Paulo',
  dayStartMinutes: 420,
  dayEndMinutes: 1320,
  theme: 'sistema',
  reduceMotion: false,
  createdAt: 1,
};

defineRepositoryContract('memória', () => ({ repository: createMemoryRepository(), userId: 'u1' }));
defineRepositoryContract('armazenamento (chave e valor)', () => ({
  repository: createStorageRepository(createMemoryAdapter()),
  userId: 'u1',
}));

describe('repositório sobre armazenamento', () => {
  it('persiste em JSON e outro repositório no mesmo adaptador lê o mesmo', async () => {
    const adapter = createMemoryAdapter();
    await createStorageRepository(adapter).saveUser(user);
    expect(JSON.parse((await adapter.getItem(STORAGE_KEY))!).user.frogName).toBe('Pulo');
    expect(await createStorageRepository(adapter).getUser()).toEqual(user);
  });
  it('JSON corrompido ou de outra versão vira banco vazio, sem quebrar', async () => {
    const adapter = createMemoryAdapter({ [STORAGE_KEY]: '{nao e json' });
    expect(await createStorageRepository(adapter).listBlocks()).toEqual([]);
    await adapter.setItem(STORAGE_KEY, JSON.stringify({ version: 99 }));
    expect(await createStorageRepository(adapter).getUser()).toBeNull();
  });
});
