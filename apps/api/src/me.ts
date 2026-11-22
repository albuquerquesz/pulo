import {
  applyUserMetadataPatch,
  readUserMetadata,
  userMetadataPatchSchema,
} from '@pulo/core/domain/user-metadata';
import { Hono } from 'hono';
import type { Auth } from './auth';

/** Rotas da conta logada: perfil básico e metadados. */
export function meRoutes(auth: Auth, now: () => number) {
  return new Hono()
    .get('/', async (c) => {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!session) return c.json({ error: 'nao_autenticado' }, 401);
      const { id, name, email, image, metadata } = session.user;
      return c.json({ user: { id, name, email, image }, metadata: readUserMetadata(metadata) });
    })
    .patch('/metadata', async (c) => {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!session) return c.json({ error: 'nao_autenticado' }, 401);
      const patch = userMetadataPatchSchema.safeParse(await c.req.json().catch(() => null));
      if (!patch.success) return c.json({ error: 'corpo_invalido' }, 400);

      const metadata = applyUserMetadataPatch(readUserMetadata(session.user.metadata), patch.data, now());
      const context = await auth.$context;
      await context.internalAdapter.updateUser(session.user.id, { metadata });
      return c.json({ metadata });
    });
}
