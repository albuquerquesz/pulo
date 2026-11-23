import type { Habit, Repository, RoutineBlock } from '../domain/types';

/**
 * Escritas em lote, opcionais. Um repositório remoto as implementa para gravar vários itens numa só chamada
 * (tudo ou nada); os repositórios locais não precisam (quem usa cai no `saveBlock` e `saveHabit` item a item).
 */
export interface BatchWrites {
  saveBlocks(blocks: readonly RoutineBlock[]): Promise<void>;
  saveHabits(habits: readonly Habit[]): Promise<void>;
}

export type BatchRepository = Repository & BatchWrites;

export function supportsBatch(repo: Repository): repo is BatchRepository {
  return 'saveBlocks' in repo && typeof repo.saveBlocks === 'function' && 'saveHabits' in repo && typeof repo.saveHabits === 'function';
}
