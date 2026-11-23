import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '#client';

/** Evento de query do Prisma (SQL e duração). */
export interface QueryEvent {
  query: string;
  params: string;
  /** Duração em ms. */
  duration: number;
}

export interface CreateDbOptions {
  /** Chamado a cada SQL enviado ao banco. Usado pelos testes (ver `countQueries`). */
  onQuery?: (event: QueryEvent) => void;
  /** Máximo de conexões do pool deste cliente. Em Worker o padrão é 1 (uma requisição, uma conexão). */
  maxConnections?: number;
}

function buildClient(databaseUrl: string, maxConnections: number) {
  const adapter = new PrismaPg({ connectionString: databaseUrl, max: maxConnections });
  return new PrismaClient({ adapter, log: [{ emit: 'event', level: 'query' }] });
}

/** Cliente do Prisma ligado ao Postgres. O tipo vem da fábrica para o `$on('query')` ser tipado. */
export type Db = ReturnType<typeof buildClient>;

/**
 * Cria um cliente Prisma para `databaseUrl` (DATABASE_URL: Postgres local, Supabase ou Hyperdrive).
 *
 * No Cloudflare Workers crie UM cliente por requisição e nunca o compartilhe entre requisições:
 * uma conexão de I/O aberta numa requisição não pode ser usada em outra. Feche ao fim com
 * `ctx.waitUntil(db.$disconnect())`.
 */
export function createDb(databaseUrl: string, options: CreateDbOptions = {}): Db {
  const db = buildClient(databaseUrl, options.maxConnections ?? 1);
  const { onQuery } = options;
  if (onQuery) {
    db.$on('query', (event) => onQuery({ query: event.query, params: event.params, duration: event.duration }));
  }
  return db;
}
