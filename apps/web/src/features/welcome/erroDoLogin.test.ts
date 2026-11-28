import { erroDoLoginNaUrl } from './erroDoLogin';

describe('erroDoLoginNaUrl', () => {
  test('sem erro na URL não há aviso', () => {
    expect(erroDoLoginNaUrl('')).toBeNull();
  });

  test('cancelado, falha e pedido de outro app têm texto em português', () => {
    expect(erroDoLoginNaUrl('?erro=login&error=access_denied')).toMatch(/cancelado/);
    expect(erroDoLoginNaUrl('?error=state_mismatch')).toBe('Não consegui entrar com o Google. Tente de novo.');
    expect(erroDoLoginNaUrl('?erro=conexao&error=access_denied')).toMatch(/conecte de novo/);
  });
});
