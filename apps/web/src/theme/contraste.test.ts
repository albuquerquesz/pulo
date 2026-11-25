import {
  CONTRASTE_MINIMO,
  CONTRASTE_MINIMO_GRANDE,
  TEMAS_PARA_CONTRASTE,
  inkSobreAcao,
  minimoDoPar,
  paresDoRascunho,
  paresPermitidos,
  passaContraste,
  razaoDeContraste,
} from './contraste';
import { darkColors, lightColors } from './tokens';

describe('razaoDeContraste', () => {
  test('valores conhecidos', () => {
    expect(razaoDeContraste('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(razaoDeContraste('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(razaoDeContraste('#767676', '#FFFFFF')).toBeCloseTo(4.54, 1);
  });
  test('é simétrica', () => {
    expect(razaoDeContraste(lightColors.ink, lightColors.sapo)).toBeCloseTo(
      razaoDeContraste(lightColors.sapo, lightColors.ink),
      10,
    );
  });
  test('bate com os números do conceito (spec 02)', () => {
    expect(razaoDeContraste(inkSobreAcao, lightColors.sapo)).toBeCloseTo(9.17, 1);
    expect(razaoDeContraste(inkSobreAcao, lightColors.foco)).toBeCloseTo(5.78, 1);
    expect(razaoDeContraste(inkSobreAcao, lightColors.agua)).toBeCloseTo(7.13, 1);
    expect(razaoDeContraste(inkSobreAcao, lightColors.sol)).toBeCloseTo(10.29, 1);
    expect(razaoDeContraste(lightColors.muted, lightColors.surface)).toBeCloseTo(5.59, 1);
  });
});

describe('pares de texto permitidos', () => {
  for (const [nome, cores] of Object.entries(TEMAS_PARA_CONTRASTE)) {
    describe(`tema ${nome}`, () => {
      const pares = paresPermitidos(cores);
      test.each(pares.map((p) => [p.nome, p] as const))('%s', (_n, par) => {
        expect(razaoDeContraste(par.texto, par.fundo)).toBeGreaterThanOrEqual(CONTRASTE_MINIMO);
        expect(passaContraste(par)).toBe(true);
      });
    });
  }

  test.each(paresDoRascunho().map((p) => [p.nome, p] as const))('rascunho: %s', (_n, par) => {
    expect(passaContraste(par)).toBe(true);
  });

  test('texto grande exige 3', () => {
    expect(minimoDoPar({ nome: 'x', texto: '#000', fundo: '#fff', grande: true })).toBe(CONTRASTE_MINIMO_GRANDE);
  });

  test('caso negativo de propósito: branco sobre foco falha', () => {
    const par = { nome: 'branco sobre foco', texto: '#FFFFFF', fundo: lightColors.foco };
    expect(razaoDeContraste(par.texto, par.fundo)).toBeCloseTo(2.57, 1);
    expect(passaContraste(par)).toBe(false);
    expect(passaContraste({ ...par, grande: true })).toBe(false);
  });

  test('o ink do tema escuro (claro) falharia sobre as cores de ação, por isso o ink de ação é fixo', () => {
    expect(passaContraste({ nome: 'x', texto: darkColors.ink, fundo: darkColors.foco })).toBe(false);
  });
});
