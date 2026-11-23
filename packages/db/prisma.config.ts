import { defineConfig } from 'prisma/config';
import { loadRootEnv } from './prisma/load-env';

loadRootEnv();

// A CLI (migrate, studio, generate) lê DATABASE_URL do ambiente ou do .env da raiz. Em produção, é a conexão
// DIRETA do Postgres (porta 5432), nunca a do pooler em modo transação. Para `prisma generate` a URL não é usada.
const FALLBACK_LOCAL_URL = 'postgresql://pulo:pulo@localhost:5432/pulo';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? FALLBACK_LOCAL_URL,
  },
});
