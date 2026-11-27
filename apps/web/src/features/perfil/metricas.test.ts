import { nomeDoDia, porcentagem, SEM_NUMERO } from './metricas';

describe('métricas do Perfil', () => {
  test('porcentagem, período e dia, com traço sem dado', () => {
    expect(porcentagem(0.714)).toBe('71%');
    expect(porcentagem(0)).toBe('0%');
    expect(porcentagem(null)).toBe(SEM_NUMERO);
    expect(nomeDoDia(5)).toBe('sábado');
    expect(nomeDoDia(null)).toBe(SEM_NUMERO);
  });
});
