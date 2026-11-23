import { idSchema } from '../api/schemas';
import { ID_RANDOM_CHARS, type RandomBytes, newId } from './ids';

const fixed = (value: number): RandomBytes => (length) => new Uint8Array(length).fill(value);

describe('newId', () => {
  it('com a fonte aleatória injetada o id é previsível', () => {
    expect(newId(36, 'bloco', fixed(0))).toBe('bloco-10-000000000000');
    expect(newId(36, 'bloco', fixed(31))).toBe('bloco-10-vvvvvvvvvvvv');
    expect(newId(36, 'bloco', fixed(33))).toBe('bloco-10-111111111111');
  });

  it('pede só os bytes de que precisa e aceita fonte que devolve a mais', () => {
    const lengths: number[] = [];
    newId(1, 'x', (length) => {
      lengths.push(length);
      return new Uint8Array(length + 5);
    });
    expect(lengths).toEqual([ID_RANDOM_CHARS]);
  });

  it('sem injeção usa crypto.getRandomValues: válido para o idSchema e sem colisão no mesmo instante', () => {
    const ids = new Set(Array.from({ length: 5000 }, () => newId(1_795_000_000_000, 'proposta')));
    expect(ids.size).toBe(5000);
    for (const id of ids) expect(idSchema.safeParse(id).success).toBe(true);
  });

  it('o prefixo mais longo do app e um instante enorme ainda cabem em 64 caracteres', () => {
    const id = newId(Number.MAX_SAFE_INTEGER, 'proposta');
    expect(id.length).toBeLessThanOrEqual(64);
    expect(idSchema.safeParse(id).success).toBe(true);
  });

  it('sem crypto no ambiente falha com mensagem clara', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      expect(() => newId(1)).toThrow(/getRandomValues/);
    } finally {
      if (original) Object.defineProperty(globalThis, 'crypto', original);
    }
  });
});
