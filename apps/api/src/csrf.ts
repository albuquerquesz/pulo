import { createMiddleware } from 'hono/factory';
import { ApiError } from './http';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Proteção CSRF das rotas `/api/*` que mudam dados com a sessão em cookie (exceto `/api/auth/*`, que o Better Auth já protege).
 * Confere o cabeçalho Origin contra as origens configuradas do app web (`PULO_CORS_ORIGIN`):
 * - Origin de outro site (ou `null`): 403 `origem_nao_permitida`;
 * - sem Origin mas com cookie (ou `Sec-Fetch-Site`, que só navegadores mandam): 403 `origem_ausente`
 *   (todo navegador manda Origin em PUT, PATCH, POST e DELETE);
 * - leituras (GET, HEAD, OPTIONS) não são afetadas;
 * - sem Origin, sem cookie e sem cabeçalhos de navegador: segue, e a rota responde 401 por falta de sessão.
 */
export function originGuard(allowedOrigins: readonly string[]) {
  const allowed = new Set(allowedOrigins);
  return createMiddleware(async (c, next) => {
    const path = c.req.path;
    const guarded = (path === '/api' || path.startsWith('/api/')) && path !== '/api/auth' && !path.startsWith('/api/auth/');
    if (!guarded || SAFE_METHODS.has(c.req.method)) return next();

    const origin = c.req.header('origin');
    if (origin === undefined) {
      if (c.req.header('cookie') !== undefined || c.req.header('sec-fetch-site') !== undefined) {
        throw new ApiError(403, 'origem_ausente', 'A requisição precisa informar a origem do app.');
      }
      return next();
    }
    if (!allowed.has(origin)) {
      throw new ApiError(403, 'origem_nao_permitida', 'Esta origem não pode alterar dados da conta.');
    }
    return next();
  });
}
