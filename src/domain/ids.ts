import type { EntityId } from './types';

let counter = 0;

/** Id único e determinístico dado o instante. Sem aleatoriedade, sem Date.now(). */
export function newId(now: number, prefix = 'id'): EntityId {
  counter += 1;
  return `${prefix}-${now.toString(36)}-${counter.toString(36)}`;
}
