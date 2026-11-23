import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { inject } from 'vitest';
import { type Db, createDb } from '../client';
import { createQueryRecorder } from './count-queries';
import { withDatabase } from './urls';

declare module 'vitest' {
  export interface ProvidedContext {
    /** URL de administração do Postgres dos testes e nome do banco modelo, já migrado. */
    puloPostgres: { adminUrl: string; template: string };
  }
}

export interface TestDatabase {
  /** Cliente Prisma do banco deste arquivo de teste (já com o contador de queries ligado). */
  db: Db;
  /** URL de conexão (DATABASE_URL) do banco deste arquivo. */
  url: string;
  /** Conta as queries SQL de um trecho assíncrono. Ver `createQueryRecorder`. */
  countQueries: ReturnType<typeof createQueryRecorder>['countQueries'];
  /** Desconecta e apaga o banco. Chame no `afterAll`. */
  close(): Promise<void>;
}

/**
 * Cria um banco novo e isolado (clone do modelo já migrado) para um arquivo de teste.
 * Use no `beforeAll` e feche no `afterAll`. Precisa do global setup de `@pulo/db/testing/global-setup`.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const { adminUrl, template } = inject('puloPostgres');
  const name = `pulo_test_${randomUUID().replaceAll('-', '')}`;

  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}" TEMPLATE "${template}"`);
  } finally {
    await admin.end();
  }

  const url = withDatabase(adminUrl, name);
  const recorder = createQueryRecorder();
  const db = createDb(url, { onQuery: recorder.record, maxConnections: 4 });

  return {
    db,
    url,
    countQueries: recorder.countQueries,
    async close() {
      await db.$disconnect();
      const cleanup = new pg.Client({ connectionString: adminUrl });
      await cleanup.connect();
      try {
        await cleanup.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      } finally {
        await cleanup.end();
      }
    },
  };
}
