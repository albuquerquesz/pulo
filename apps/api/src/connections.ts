import type { McpConnection } from '@pulo/core/api/schemas';
import type { Db } from '@pulo/db';

/**
 * Os aplicativos que a pessoa liberou (consentimentos OAuth), um por cliente, o mais recente primeiro.
 * Uma query (o nome do cliente vem no mesmo SELECT). Nunca lê segredo nem token.
 */
export async function listConnections(db: Db, userId: string): Promise<McpConnection[]> {
  const consents = await db.oauthConsent.findMany({
    where: { userId },
    select: { clientId: true, scopes: true, createdAt: true, updatedAt: true, client: { select: { name: true } } },
    orderBy: [{ updatedAt: 'desc' }, { clientId: 'asc' }],
    relationLoadStrategy: 'join',
  });
  const byClient = new Map<string, McpConnection>();
  for (const consent of consents) {
    const connectedAt = consent.createdAt?.getTime() ?? 0;
    const updatedAt = consent.updatedAt?.getTime() ?? connectedAt;
    const known = byClient.get(consent.clientId);
    byClient.set(consent.clientId, {
      clientId: consent.clientId,
      name: consent.client.name,
      scopes: [...new Set([...(known?.scopes ?? []), ...consent.scopes])],
      connectedAt: Math.min(connectedAt, known?.connectedAt ?? connectedAt),
      updatedAt: Math.max(updatedAt, known?.updatedAt ?? updatedAt),
    });
  }
  return [...byClient.values()];
}

/**
 * Revoga o acesso de um aplicativo: consentimento, tokens e códigos de autorização ainda não trocados, só desta pessoa.
 * Devolve quantos consentimentos saíram (0 se já não havia).
 */
export async function revokeConnection(db: Db, userId: string, clientId: string): Promise<number> {
  const where = { userId, clientId };
  const [, , , consents] = await db.$transaction([
    db.oauthAccessToken.deleteMany({ where }),
    db.oauthRefreshToken.deleteMany({ where }),
    db.verification.deleteMany({ where: { AND: [{ value: { contains: userId } }, { value: { contains: clientId } }] } }),
    db.oauthConsent.deleteMany({ where }),
  ]);
  return consents.count;
}
