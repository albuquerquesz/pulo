import { LAGOON_MAX_ANIMATED_ELEMENTS } from '@/config/decisions';

import { itensVisiveis, planoDeAnimacao, type AgoraDaLagoa } from './lagoa';

const resumo = (careDays: number, stable = false) => ({ careDays, stable });
const dia = (dias: number, o: Partial<AgoraDaLagoa> = {}): AgoraDaLagoa => ({
  diasDeCuidadoTotal: dias,
  dentroDoDia: true,
  descansoHoje: false,
  ...o,
});

describe('itensVisiveis', () => {
  test.each([
    [0, ['pedra']],
    [1, ['pedra', 'juncos']],
    [3, ['pedra', 'juncos', 'folhaVitoriaRegia']],
    [5, ['pedra', 'juncos', 'folhaVitoriaRegia', 'aguape']],
    [8, ['pedra', 'juncos', 'folhaVitoriaRegia', 'aguape', 'tronco']],
    [11, ['pedra', 'juncos', 'folhaVitoriaRegia', 'aguape', 'tronco', 'flor']],
  ])('com %i dias de cuidado', (dias, esperado) => {
    expect(itensVisiveis(resumo(0), dia(dias)).progresso).toEqual(esperado);
  });

  test('progresso é monotônico', () => {
    let antes: string[] = [];
    for (let d = 0; d <= 20; d++) {
      const agora = itensVisiveis(resumo(0), dia(d)).progresso;
      for (const i of antes) expect(agora).toContain(i);
      antes = agora;
    }
  });

  test('nuvem aparece com descanso hoje e some sem ele', () => {
    expect(itensVisiveis(resumo(0), dia(2, { descansoHoje: true })).estado).toContain('nuvemDeChuva');
    expect(itensVisiveis(resumo(0), dia(2)).estado).not.toContain('nuvemDeChuva');
  });

  test('descanso hoje deixa a paleta noturna mesmo no dia do usuário', () => {
    expect(itensVisiveis(resumo(0), dia(2, { descansoHoje: true })).noite).toBe(true);
    expect(itensVisiveis(resumo(0), dia(2)).noite).toBe(false);
  });

  test('vagalumes só à noite e só com 3 dias de cuidado na semana', () => {
    expect(itensVisiveis(resumo(3), dia(9, { dentroDoDia: false })).estado).toContain('vagalumes');
    expect(itensVisiveis(resumo(2), dia(9, { dentroDoDia: false })).estado).not.toContain('vagalumes');
    expect(itensVisiveis(resumo(5), dia(9)).estado).not.toContain('vagalumes');
  });

  test('semana estável é repassada', () => {
    expect(itensVisiveis(resumo(5, true), dia(9)).estavel).toBe(true);
  });
});

describe('planoDeAnimacao', () => {
  const tudo = itensVisiveis(resumo(5), dia(20, { dentroDoDia: false, descansoHoje: true }));
  test('nunca passa do limite', () => {
    const p = planoDeAnimacao(tudo, false);
    expect(p.total).toBeLessThanOrEqual(LAGOON_MAX_ANIMATED_ELEMENTS);
    expect(p.sapo + p.ondinhas + p.folhas + p.vagalumes + p.gotas).toBe(p.total);
  });
  test('limite pequeno é respeitado', () => {
    expect(planoDeAnimacao(tudo, false, 4).total).toBe(4);
  });
  test('reduzir movimento: nenhuma animação ambiente', () => {
    expect(planoDeAnimacao(tudo, true).total).toBe(0);
  });
});
