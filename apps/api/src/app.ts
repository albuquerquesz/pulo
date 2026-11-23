import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Db } from '@pulo/db';
import { type AuthEnv, createAuth } from './auth';
import { originGuard } from './csrf';
import { type RouteDeps, handleError, handleNotFound } from './http';
import { meRoutes } from './me';
import { blockRoutes } from './routes/blocks';
import { checkInRoutes } from './routes/check-ins';
import { dataRoutes } from './routes/data';
import { habitLogRoutes } from './routes/habit-logs';
import { habitRoutes } from './routes/habits';
import { mascotRoutes } from './routes/mascot';
import { proposalRoutes } from './routes/proposals';
import { restDayRoutes } from './routes/rest-days';
import { sessionRoutes } from './routes/sessions';
import { syncRoutes } from './routes/sync';
import { weekSummaryRoutes } from './routes/week-summary';
import { resolveWebConfig } from './web-config';
import { type AiEnv, createProviderFromEnv, handleWeeklyAi } from './weekly-ai';

export type ApiEnv = AiEnv &
  AuthEnv & {
    PULO_CORS_ORIGIN?: string;
  };

/**
 * Monta a API. O ambiente e o cliente do banco são injetados: o Worker cria um `Db` por requisição
 * (e o fecha depois), os testes passam o do Postgres de teste.
 */
export function createApp(env: ApiEnv, db: Db, now = Date.now) {
  const provider = createProviderFromEnv(env);
  const web = resolveWebConfig(env);
  const auth = createAuth(env, web, db);
  const deps: RouteDeps = { auth, db, now };

  return new Hono()
    .use(
      '*',
      cors({
        origin: web.origins,
        credentials: true,
        allowHeaders: ['Content-Type', 'Authorization'],
        allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      }),
    )
    .use('*', originGuard(web.origins))
    .get('/health', (c) => c.json({ ok: true }))
    .on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))
    .route('/api/me', meRoutes(auth, now))
    .route('/api/blocks', blockRoutes(deps))
    .route('/api/habits', habitRoutes(deps))
    .route('/api/habit-logs', habitLogRoutes(deps))
    .route('/api/sessions', sessionRoutes(deps))
    .route('/api/check-ins', checkInRoutes(deps))
    .route('/api/rest-days', restDayRoutes(deps))
    .route('/api/proposals', proposalRoutes(deps))
    .route('/api/mascot', mascotRoutes(deps))
    .route('/api/week-summary', weekSummaryRoutes(deps))
    .route('/api/sync', syncRoutes(deps))
    .route('/api/data', dataRoutes(deps))
    .post('/weekly-ai', async (c) => {
      const body = await c.req.json().catch(() => null);
      const response = await handleWeeklyAi({ method: 'POST', body }, { provider });
      return Response.json(response.body, { status: response.status });
    })
    .onError(handleError)
    .notFound(handleNotFound);
}

/** Tipo da API para o cliente tipado do app: `hc<AppType>(url)`. */
export type AppType = ReturnType<typeof createApp>;
