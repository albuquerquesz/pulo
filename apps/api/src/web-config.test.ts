import { parseOrigins, resolveWebConfig } from './web-config';

const base = { BETTER_AUTH_URL: 'http://localhost:8787' };

describe('parseOrigins', () => {
  it('normaliza, tira repetidas e barras, e usa o padrão sem valor', () => {
    expect(parseOrigins(undefined)).toEqual(['http://localhost:8081']);
    expect(parseOrigins(' https://app.exemplo.com/ , https://app.exemplo.com,http://localhost:8081 ')).toEqual([
      'https://app.exemplo.com',
      'http://localhost:8081',
    ]);
  });
  it('recusa valor que não é origem http ou https', () => {
    expect(() => parseOrigins('pulo://')).toThrow(/PULO_CORS_ORIGIN/);
    expect(() => parseOrigins('isto não é url')).toThrow();
  });
});

describe('resolveWebConfig', () => {
  it('dev: portas diferentes em localhost é o mesmo site, Lax e sem Secure', () => {
    expect(resolveWebConfig(base).cookie).toEqual({ httpOnly: true, secure: false, sameSite: 'lax', path: '/', domain: undefined });
  });

  it('produção com app. e api. sob um domínio: Lax, Secure e domínio compartilhado', () => {
    const config = resolveWebConfig({
      BETTER_AUTH_URL: 'https://api.exemplo.com',
      PULO_CORS_ORIGIN: 'https://app.exemplo.com',
      PULO_COOKIE_DOMAIN: '.Exemplo.com',
    });
    expect(config.cookie).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/', domain: 'exemplo.com' });
    expect(config.origins).toEqual(['https://app.exemplo.com']);
  });

  it('subdomínios irmãos sem PULO_COOKIE_DOMAIN: não dá para provar o mesmo site, então None (cookie só do host da API)', () => {
    const config = resolveWebConfig({ BETTER_AUTH_URL: 'https://api.exemplo.com', PULO_CORS_ORIGIN: 'https://app.exemplo.com' });
    expect(config.cookie).toMatchObject({ secure: true, sameSite: 'none', domain: undefined });
  });

  it('produção em sites diferentes (pages.dev e workers.dev): None e Secure, sem domínio', () => {
    const config = resolveWebConfig({
      BETTER_AUTH_URL: 'https://pulo-api.conta.workers.dev',
      PULO_CORS_ORIGIN: 'https://pulo.pages.dev',
    });
    expect(config.cookie).toEqual({ httpOnly: true, secure: true, sameSite: 'none', path: '/', domain: undefined });
  });

  it('uma origem de outro site basta para exigir None; dev com app local contra API publicada também', () => {
    expect(
      resolveWebConfig({ BETTER_AUTH_URL: 'https://api.exemplo.com', PULO_CORS_ORIGIN: 'https://api.exemplo.com,http://localhost:8081' }).cookie.sameSite,
    ).toBe('none');
  });

  it('o domínio do cookie precisa cobrir a API e todas as origens', () => {
    expect(() =>
      resolveWebConfig({ BETTER_AUTH_URL: 'https://api.exemplo.com', PULO_CORS_ORIGIN: 'https://pulo.pages.dev', PULO_COOKIE_DOMAIN: 'exemplo.com' }),
    ).toThrow(/não cobre: https:\/\/pulo\.pages\.dev/);
  });
});
