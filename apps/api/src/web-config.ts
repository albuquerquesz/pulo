/**
 * Configuração da sessão por cookie para o app web, toda derivada do ambiente:
 * `PULO_CORS_ORIGIN` (origens do app web), `BETTER_AUTH_URL` (endereço público da API) e
 * `PULO_COOKIE_DOMAIN` (opcional, para `app.x` e `api.x`). Funções puras, sem I/O.
 */
export interface WebEnv {
  /** Origens do app web, separadas por vírgula. Padrão: o Expo web local. */
  PULO_CORS_ORIGIN?: string | undefined;
  /** Endereço público da API (https em produção, http://localhost em dev). */
  BETTER_AUTH_URL: string;
  /** Domínio pai do cookie (ex.: `exemplo.com`) quando app e API são subdomínios irmãos. Padrão: só o host da API. */
  PULO_COOKIE_DOMAIN?: string | undefined;
}

export const DEFAULT_WEB_ORIGIN = 'http://localhost:8081';

export interface SessionCookieConfig {
  /** HttpOnly sempre: o JavaScript do app nunca lê a sessão. */
  httpOnly: true;
  /** Secure quando a API é https (produção) e sempre que `SameSite=None`. */
  secure: boolean;
  /** `lax` com app e API no mesmo site; `none` quando são sites diferentes. */
  sameSite: 'lax' | 'none';
  path: '/';
  /** Só quando `PULO_COOKIE_DOMAIN` foi definido (e é válido para a API e para o app). */
  domain: string | undefined;
}

export interface WebConfig {
  /** Origens exatas do app web (esquema, host e porta), sem barra no fim e sem repetidas. */
  origins: string[];
  cookie: SessionCookieConfig;
}

/** `PULO_CORS_ORIGIN` em origens normalizadas. Valor inválido derruba a montagem da API (erro de configuração). */
export function parseOrigins(value: string | undefined): string[] {
  const parts = (value ?? DEFAULT_WEB_ORIGIN)
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  const origins = new Set<string>();
  for (const part of parts.length > 0 ? parts : [DEFAULT_WEB_ORIGIN]) {
    const url = new URL(part);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`PULO_CORS_ORIGIN: origem inválida "${part}" (use http ou https).`);
    }
    origins.add(url.origin);
  }
  return [...origins];
}

function normalizeDomain(value: string | undefined): string | undefined {
  const domain = value?.trim().replace(/^\./, '').toLowerCase();
  return domain ? domain : undefined;
}

const isUnderDomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/**
 * Mesmo site (regra do SameSite, sem a porta): com `PULO_COOKIE_DOMAIN`, quando API e app estão sob o domínio;
 * sem ele, quando o host é o mesmo (`localhost:8081` e `localhost:8787` são o mesmo site).
 */
function sameSite(apiHost: string, originHost: string, domain: string | undefined): boolean {
  return domain ? isUnderDomain(apiHost, domain) && isUnderDomain(originHost, domain) : apiHost === originHost;
}

export function resolveWebConfig(env: WebEnv): WebConfig {
  const origins = parseOrigins(env.PULO_CORS_ORIGIN);
  const api = new URL(env.BETTER_AUTH_URL);
  const domain = normalizeDomain(env.PULO_COOKIE_DOMAIN);

  if (domain) {
    const outside = [api.origin, ...origins].filter((origin) => !isUnderDomain(new URL(origin).hostname, domain));
    if (outside.length > 0) {
      throw new Error(`PULO_COOKIE_DOMAIN="${domain}" não cobre: ${outside.join(', ')}.`);
    }
  }

  const allSameSite = origins.every((origin) => sameSite(api.hostname, new URL(origin).hostname, domain));
  const site = allSameSite ? 'lax' : 'none';
  return {
    origins,
    cookie: {
      httpOnly: true,
      // `SameSite=None` exige Secure; fora disso, só em https (em dev http://localhost o cookie vai sem Secure).
      secure: api.protocol === 'https:' || site === 'none',
      sameSite: site,
      path: '/',
      domain,
    },
  };
}
