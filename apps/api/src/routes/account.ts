import { deleteAccountBodySchema } from '@pulo/core/api/schemas';
import { Hono } from 'hono';
import { type AppEnv, type RouteDeps, jsonBody, requireSession } from '../http';

/**
 * `DELETE /api/account`: exclui a conta de vez. Apagar o `user` leva junto, por cascata, todas as tabelas da pessoa
 * (domínio, login e OAuth). Numa transação saem também o que não tem chave estrangeira (códigos de autorização em
 * `verification`) e, antes, um cliente OAuth registrado por ela que outra pessoa também usa só perde o dono, para a
 * cascata não derrubar o acesso alheio. A resposta apaga o cookie da sessão.
 */
export function accountRoutes({ auth, db }: RouteDeps) {
  return new Hono<AppEnv>().use(requireSession(auth)).delete('/', jsonBody(deleteAccountBodySchema), async (c) => {
    const userId = c.var.user.id;
    const others = { some: { userId: { not: userId } } };
    await db.$transaction([
      db.oauthClient.updateMany({
        where: { userId, OR: [{ consents: others }, { refreshTokens: others }, { accessTokens: others }] },
        data: { userId: null },
      }),
      db.verification.deleteMany({ where: { value: { contains: userId } } }),
      db.user.delete({ where: { id: userId }, select: { id: true } }),
    ]);
    // A sessão já saiu com a cascata: o `signOut` serve para devolver os `Set-Cookie` que apagam o cookie no navegador.
    const { headers } = await auth.api.signOut({ headers: c.req.raw.headers, returnHeaders: true });
    for (const cookie of headers.getSetCookie()) c.header('Set-Cookie', cookie, { append: true });
    return c.json({ deleted: true });
  });
}
