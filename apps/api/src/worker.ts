import { createDb } from '@pulo/db';
import { type ApiEnv, createApp } from './app';

/** Binding opcional do Hyperdrive (pool e cache de conexões do Cloudflare na frente do Postgres). */
type WorkerEnv = Omit<ApiEnv, 'DATABASE_URL'> & {
  DATABASE_URL?: string;
  HYPERDRIVE?: { connectionString: string };
};

/** Só o que usamos do ExecutionContext do Workers. */
interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

// Entrada do Cloudflare Worker. O ambiente (vars, secrets e bindings) chega a cada requisição.
export default {
  async fetch(request: Request, env: WorkerEnv, ctx: WorkerContext): Promise<Response> {
    const databaseUrl = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
    if (!databaseUrl) {
      if (new URL(request.url).pathname === '/health') return Response.json({ ok: true, database: false });
      return Response.json({ error: 'banco_nao_configurado' }, { status: 503 });
    }

    // Um cliente (e uma conexão) por requisição: o Workers não deixa reusar I/O entre requisições.
    const db = createDb(databaseUrl);
    try {
      return await createApp({ ...env, DATABASE_URL: databaseUrl }, db).fetch(request);
    } finally {
      // Fecha depois de enviar a resposta, sem atrasá-la.
      ctx.waitUntil(db.$disconnect());
    }
  },
};
