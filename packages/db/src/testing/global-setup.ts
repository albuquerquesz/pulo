import pg from 'pg';
import type { TestProject } from 'vitest/node';
import { startEmbeddedPostgres } from './embedded';
import { applyMigrations } from './migrations';
import { withDatabase } from './urls';

export const TEMPLATE_DATABASE = 'pulo_template';

/**
 * Global setup do Vitest: uma instância de Postgres por execução e um banco modelo com as migrações.
 * Cada arquivo de teste clona o modelo (ver `createTestDatabase`).
 *
 * Com PULO_TEST_DATABASE_URL (URL de superusuário de um Postgres existente, como o `services: postgres` do
 * GitHub Actions) usa esse servidor; sem ela, sobe o embedded-postgres.
 */
export default async function setup(project: TestProject) {
  const external = process.env.PULO_TEST_DATABASE_URL;
  const embedded = external ? null : await startEmbeddedPostgres();
  const adminUrl = external ?? embedded?.adminUrl;
  if (!adminUrl) throw new Error('Postgres de teste indisponível');

  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  const template = `${TEMPLATE_DATABASE}_${process.pid}`;
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${template}"`);
    await admin.query(`CREATE DATABASE "${template}"`);
  } finally {
    await admin.end();
  }
  await applyMigrations(withDatabase(adminUrl, template));

  project.provide('puloPostgres', { adminUrl, template });

  return async () => {
    if (embedded) {
      await embedded.stop();
      return;
    }
    const cleanup = new pg.Client({ connectionString: adminUrl });
    await cleanup.connect();
    try {
      await cleanup.query(`DROP DATABASE IF EXISTS "${template}"`);
    } finally {
      await cleanup.end();
    }
  };
}
