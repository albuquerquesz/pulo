import { type UserMetadataPatch, applyUserMetadataPatch, readUserMetadata, userMetadataPatchSchema } from '@pulo/core/domain/user-metadata';
import type { Db } from '@pulo/db';
import { Hono } from 'hono';
import type { Auth } from './auth';
import { ApiError, type AppEnv, jsonBody, requireSession } from './http';

/**
 * Rotas da conta logada: perfil básico e metadados (preferências, onboarding e perfil do app).
 * Usam o mesmo middleware de sessão e validação das rotas de domínio, para o cliente `hc<AppType>` inferir o corpo.
 */
export function meRoutes(auth: Auth, db: Db, now: () => number) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/', (c) => {
      const { id, name, email, image, metadata } = c.var.user;
      return c.json({ user: { id, name, email, image }, metadata });
    })
    .patch('/metadata', jsonBody(userMetadataPatchSchema), async (c) => {
      const metadata = await patchMetadata(db, c.var.user.id, c.req.valid('json'), now());
      return c.json({ metadata });
    });
}

/**
 * Lê, aplica e grava numa transação com a linha da pessoa travada: dois aparelhos mudando preferências
 * ao mesmo tempo não apagam a mudança um do outro. O JSON é gravado como texto, como o Better Auth o lê.
 */
function patchMetadata(db: Db, userId: string, patch: UserMetadataPatch, now: number) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "user" WHERE "id" = ${userId} FOR UPDATE`;
    const row = await tx.user.findUnique({ where: { id: userId }, select: { metadata: true } });
    if (!row) throw new ApiError(404, 'nao_encontrado', 'Não encontrei essa conta.');
    const metadata = applyUserMetadataPatch(readUserMetadata(row.metadata), patch, now);
    await tx.user.update({ where: { id: userId }, data: { metadata: JSON.stringify(metadata), updatedAt: new Date(now) }, select: { id: true } });
    return metadata;
  });
}
