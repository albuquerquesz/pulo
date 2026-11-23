import { applyUserMetadataPatch, userMetadataPatchSchema } from '@pulo/core/domain/user-metadata';
import { Hono } from 'hono';
import type { Auth } from './auth';
import { type AppEnv, jsonBody, requireSession } from './http';

/**
 * Rotas da conta logada: perfil básico e metadados (preferências, onboarding e perfil do app).
 * Usam o mesmo middleware de sessão e validação das rotas de domínio, para o cliente `hc<AppType>` inferir o corpo.
 */
export function meRoutes(auth: Auth, now: () => number) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/', (c) => {
      const { id, name, email, image, metadata } = c.var.user;
      return c.json({ user: { id, name, email, image }, metadata });
    })
    .patch('/metadata', jsonBody(userMetadataPatchSchema), async (c) => {
      const metadata = applyUserMetadataPatch(c.var.user.metadata, c.req.valid('json'), now());
      const context = await auth.$context;
      await context.internalAdapter.updateUser(c.var.user.id, { metadata });
      return c.json({ metadata });
    });
}
