import type { EntityId } from './types';

/** Fonte de bytes aleatórios (injetável nos testes). Recebe o tamanho e devolve esse tanto de bytes. */
export type RandomBytes = (length: number) => Uint8Array;

/** `crypto.getRandomValues` global: existe em navegadores, no Node 20 ou mais novo e no Cloudflare Workers. */
export const secureRandomBytes: RandomBytes = (length) => {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error('crypto.getRandomValues indisponível: não dá para gerar ids aleatórios neste ambiente.');
  }
  return cryptoApi.getRandomValues(new Uint8Array(length));
};

/** 32 símbolos (5 bits cada): minúsculas e dígitos, sem viés ao mapear um byte pelos 5 bits baixos. */
const ALPHABET = '0123456789abcdefghijklmnopqrstuv';
/** 12 símbolos = 60 bits: dois aparelhos que criam algo no mesmo milissegundo quase nunca colidem. */
export const ID_RANDOM_CHARS = 12;

/**
 * Id novo no formato `prefixo-instante-aleatório` (só `[a-z0-9-]`, cabe no `idSchema` da API, no máximo 64).
 * O instante vem de `now` (nenhum `Date.now()` aqui); a parte aleatória evita colisão entre aparelhos (409 conflito_de_id).
 * Nos testes, injete `random` para ter ids previsíveis.
 */
export function newId(now: number, prefix = 'id', random: RandomBytes = secureRandomBytes): EntityId {
  const bytes = random(ID_RANDOM_CHARS);
  let suffix = '';
  for (let i = 0; i < ID_RANDOM_CHARS; i += 1) suffix += ALPHABET[(bytes[i] ?? 0) & 31];
  return `${prefix}-${now.toString(36)}-${suffix}`;
}
