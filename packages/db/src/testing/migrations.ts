import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const MIGRATIONS_DIR = new URL('../../prisma/migrations/', import.meta.url);

/** Aplica, em ordem, os migration.sql de prisma/migrations (os mesmos que o `prisma migrate deploy` usa). */
export async function applyMigrations(databaseUrl: string): Promise<void> {
  const entries = await readdir(fileURLToPath(MIGRATIONS_DIR), { withFileTypes: true });
  const names = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    for (const name of names) {
      const sql = await readFile(new URL(`${name}/migration.sql`, MIGRATIONS_DIR), 'utf8');
      await client.query(sql);
    }
  } finally {
    await client.end();
  }
}
