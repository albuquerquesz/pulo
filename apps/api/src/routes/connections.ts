import { clientIdParamSchema } from '@pulo/core/api/schemas';
import { Hono } from 'hono';
import { listConnections, revokeConnection } from '../connections';
import { type AppEnv, type RouteDeps, pathParams, requireSession } from '../http';

/** `/api/mcp/connections`: ver e desconectar o Claude e outros clientes MCP. */
export function connectionRoutes({ auth, db }: RouteDeps) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/', async (c) => c.json({ connections: await listConnections(db, c.var.user.id) }))
    .delete('/:clientId', pathParams(clientIdParamSchema), async (c) =>
      c.json({ deleted: await revokeConnection(db, c.var.user.id, c.req.valid('param').clientId) }),
    );
}
