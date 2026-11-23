// Postgres local SEM Docker (binários do embedded-postgres, sem root), com os mesmos dados de acesso do
// docker-compose: usuário, senha e banco "pulo". Dados em packages/db/.embedded-pg (ignorado pelo git).
// Uso: npm run db:embedded (deixe rodando; Ctrl+C para parar).
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const databaseDir = fileURLToPath(new URL('../.embedded-pg', import.meta.url));
const port = Number(process.env.PULO_PG_PORT ?? 5432);

const server = new EmbeddedPostgres({ databaseDir, port, user: 'pulo', password: 'pulo', persistent: true });
const fresh = !existsSync(`${databaseDir}/PG_VERSION`);
if (fresh) await server.initialise();
await server.start();
if (fresh) await server.createDatabase('pulo');
console.log(`Postgres embutido pronto: postgresql://pulo:pulo@localhost:${port}/pulo`);

async function shutdown() {
  await server.stop();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
