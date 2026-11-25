import { caixa, projetar, telhado } from './geometria';

describe('gerador isométrico', () => {
  test('a origem fica no centro da ilha e a altura sobe', () => {
    expect(projetar([0, 0, 0])).toEqual({ x: 500, y: 480 });
    expect(projetar([0, 0, 1])).toEqual({ x: 500, y: 434 });
    expect(projetar([1, 0, 0])).toEqual({ x: 539.8, y: 503 });
    expect(projetar([0, 1, 0])).toEqual({ x: 460.2, y: 503 });
  });

  test('uma caixa simples tem esquerda, direita e topo', () => {
    const cores = { esquerda: 'e', direita: 'd', topo: 't' };
    expect(caixa({ u: [0, 1], v: [0, 1], z: [0, 1] }, cores)).toEqual([
      { cor: 'e', pontos: '460.2,503.0 500.0,526.0 500.0,480.0 460.2,457.0' },
      { cor: 'd', pontos: '539.8,503.0 500.0,526.0 500.0,480.0 539.8,457.0' },
      { cor: 't', pontos: '500.0,434.0 539.8,457.0 500.0,480.0 460.2,457.0' },
    ]);
    expect(caixa({ u: [0, 1], v: [0, 1], z: [0, 1] }, { esquerda: 'e', direita: 'd' })).toHaveLength(2);
  });

  test('o telhado do quarto bate com os pontos do rascunho (a menos do arredondamento)', () => {
    const faces = telhado({ u: [-3, 0], v: [-3, 0], z: [2.6, 4] }, { fundo: 'a', empena: 'b', frente: 'c' });
    expect(faces.map((f) => f.pontos)).toEqual([
      '500.0,210.9 639.4,291.4 569.7,267.3 430.3,186.8',
      '619.5,291.4 500.0,360.4 559.8,261.5',
      '430.3,186.8 569.7,267.3 500.0,371.9 360.6,291.4',
    ]);
  });
});
