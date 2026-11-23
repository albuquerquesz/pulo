import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Db } from '@pulo/db';
import { type AuthEnv, createAuth } from './auth';
import { meRoutes } from './me';
import { type AiEnv, createProviderFromEnv, handleWeeklyAi } from './weekly-ai';

export type ApiEnv = AiEnv &
  AuthEnv & {
    PULO_CORS_ORIGIN?: string;
  };

const DEFAULT_ORIGIN = 'http://localhost:8081';

/**
 * Monta a API. O ambiente e o cliente do banco são injetados: o Worker cria um `Db` por requisição
 * (e o fecha depois), os testes passam o do Postgres de teste.
 */
export function createApp(env: ApiEnv, db: Db, now = Date.now) {
  const provider = createProviderFromEnv(env);
  const origins = (env.PULO_CORS_ORIGIN ?? DEFAULT_ORIGIN).split(',');
  const auth = createAuth(env, origins, db);

  return new Hono()
    .use(
      '*',
      cors({
        origin: origins,
        credentials: true,
        allowHeaders: ['Content-Type', 'Authorization'],
        allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
      }),
    )
    .get('/health', (c) => c.json({ ok: true }))
    .on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))
    .route('/api/me', meRoutes(auth, now))
    .post('/weekly-ai', async (c) => {
      const body = await c.req.json().catch(() => null);
      const response = await handleWeeklyAi({ method: 'POST', body }, { provider });
      return Response.json(response.body, { status: response.status });
    });
}
