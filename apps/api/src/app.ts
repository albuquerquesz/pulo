import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { type AuthDatabase, type AuthEnv, createAuth } from './auth';
import { meRoutes } from './me';
import { type AiEnv, createProviderFromEnv, handleWeeklyAi } from './weekly-ai';

export type ApiEnv = AiEnv &
  AuthEnv & {
    PULO_CORS_ORIGIN?: string;
  };

const DEFAULT_ORIGIN = 'http://localhost:3000';

/** Monta a API. O ambiente é injetado para os testes não dependerem do runtime. */
export function createApp(env: ApiEnv, database?: AuthDatabase, now = Date.now) {
  const provider = createProviderFromEnv(env);
  const origins = (env.PULO_CORS_ORIGIN ?? DEFAULT_ORIGIN).split(',');
  const auth = createAuth(env, origins, database);

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
