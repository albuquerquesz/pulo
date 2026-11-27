import { diasNoMes } from '../hoje/mes';
import { nomeDoDia, nomeDoPeriodo, porcentagem, SEM_NUMERO } from './metricas';

describe('métricas do Perfil', () => {
  test('porcentagem, período e dia, com traço sem dado', () => {
    expect(porcentagem(0.714)).toBe('71%');
    expect(porcentagem(0)).toBe('0%');
    expect(porcentagem(null)).toBe(SEM_NUMERO);
    expect(nomeDoPeriodo('manha')).toBe('manhã');
    expect(nomeDoDia(5)).toBe('sábado');
    expect(nomeDoDia(null)).toBe(SEM_NUMERO);
  });

  test('dias do mês sem repetir nem contar o futuro', () => {
    expect(diasNoMes(['2026-10-31', '2026-11-01', '2026-11-01', '2026-11-21', '2026-11-22'], '2026-11-21')).toBe(2);
  });
});
