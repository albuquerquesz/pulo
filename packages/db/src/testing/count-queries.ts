import type { QueryEvent } from '../client';

export interface QueryCount<T> {
  result: T;
  /** Quantidade de SQL enviados ao banco (sem BEGIN, COMMIT e ROLLBACK). */
  count: number;
  /** Os SQL, na ordem, para mensagens de erro e depuração. */
  queries: string[];
}

const TRANSACTION_CONTROL = /^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i;

/**
 * Recorder de queries. `record` é o `onQuery` do `createDb`; `countQueries` mede um trecho assíncrono.
 * Criado por `createTestDatabase`, que já liga os dois.
 */
export function createQueryRecorder() {
  let active: string[] | null = null;

  return {
    record(event: QueryEvent): void {
      if (active !== null && !TRANSACTION_CONTROL.test(event.query)) active.push(event.query);
    },
    /**
     * Conta quantas queries SQL `run` dispara. Use para provar que uma rota faz um número fixo de queries:
     * `expect((await countQueries(() => route())).count).toBeLessThanOrEqual(3)`.
     * Medições não podem se sobrepor (rodariam queries de uma na conta da outra).
     */
    async countQueries<T>(run: () => Promise<T>): Promise<QueryCount<T>> {
      if (active !== null) throw new Error('countQueries não pode ser aninhado nem rodar em paralelo');
      const queries: string[] = [];
      active = queries;
      try {
        const result = await run();
        return { result, count: queries.length, queries };
      } finally {
        active = null;
      }
    },
  };
}
