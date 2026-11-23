import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

export interface RunningPostgres {
  /** URL de administração (superusuário), banco `postgres`. Serve para criar e apagar bancos. */
  adminUrl: string;
  stop(): Promise<void>;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address !== null && typeof address === 'object') resolve(address.port);
        else reject(new Error('não foi possível reservar uma porta'));
      });
    });
  });
}

/**
 * Sobe um PostgreSQL de verdade (binários do pacote embedded-postgres), sem Docker e sem root,
 * num diretório temporário e numa porta livre. Apagado em `stop()`.
 */
export async function startEmbeddedPostgres(): Promise<RunningPostgres> {
  const databaseDir = await mkdtemp(join(tmpdir(), 'pulo-pg-'));
  const port = await freePort();
  const password = 'pulo-test';
  const server = new EmbeddedPostgres({
    databaseDir,
    port,
    user: 'postgres',
    password,
    persistent: false,
    // Sem fsync: é um banco descartável, e fica bem mais rápido.
    postgresFlags: ['-c', 'fsync=off', '-c', 'synchronous_commit=off', '-c', 'full_page_writes=off'],
    onLog: () => {},
    onError: () => {},
  });
  await server.initialise();
  await server.start();
  return {
    adminUrl: `postgresql://postgres:${password}@127.0.0.1:${port}/postgres`,
    async stop() {
      await server.stop();
      await rm(databaseDir, { recursive: true, force: true });
    },
  };
}
