import { diasNoMes } from '../hoje/mes';
import { comparacaoDoDescanso, nomeDoDia, nomeDoPeriodo, porcentagem, SEM_NUMERO } from './metricas';

const DESCANSO = { total: 3, noMes: 1, semanasComDescanso: 2 };

describe('métricas do Perfil', () => {
  test('porcentagem, período e dia, com traço sem dado', () => {
    expect(porcentagem(0.714)).toBe('71%');
    expect(porcentagem(0)).toBe('0%');
    expect(porcentagem(null)).toBe(SEM_NUMERO);
    expect(nomeDoPeriodo('manha')).toBe('manhã');
    expect(nomeDoDia(5)).toBe('sábado');
    expect(nomeDoDia(null)).toBe(SEM_NUMERO);
  });

  test('comparação em horas, na proporção da maior', () => {
    expect(comparacaoDoDescanso({ ...DESCANSO, focoMedioSemanaComDescanso: 150, focoMedioSemanaSem: 75 })).toEqual([
      { rotulo: 'Semanas com descanso', texto: '2h30', largura: 100, comDescanso: true },
      { rotulo: 'Semanas sem descanso', texto: '1h15', largura: 50, comDescanso: false },
    ]);
  });

  test('pouca história não tem comparação', () => {
    expect(comparacaoDoDescanso({ ...DESCANSO, focoMedioSemanaComDescanso: null, focoMedioSemanaSem: null })).toBeNull();
  });

  test('dias do mês sem repetir nem contar o futuro', () => {
    expect(diasNoMes(['2026-10-31', '2026-11-01', '2026-11-01', '2026-11-21', '2026-11-22'], '2026-11-21')).toBe(2);
  });
});
