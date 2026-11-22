import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createProviderFromEnv, handleWeeklyAi } from './weekly-ai';

type Env = Record<string, string | undefined>;

const DEFAULT_ORIGIN = 'http://localhost:8081';

/** Monta a API. O ambiente é injetado para os testes não dependerem de process.env. */
export function createApp(env: Env) {
  const provider = createProviderFromEnv(env);
  const origins = (env.PULO_CORS_ORIGIN ?? DEFAULT_ORIGIN).split(',');

  return new Hono()
    .use('*', cors({ origin: origins }))
    .get('/health', (c) => c.json({ ok: true }))
    .post('/weekly-ai', async (c) => {
      const body = await c.req.json().catch(() => null);
      const response = await handleWeeklyAi({ method: 'POST', body }, { provider });
      return Response.json(response.body, { status: response.status });
    });
}
