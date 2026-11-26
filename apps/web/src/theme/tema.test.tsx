import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render } from '@testing-library/react';

import { darkColors, drawingColors, lightColors, motion } from './tokens';
import { montarTema, resolverEsquema, resolverMovimento, resolverReduzirMovimento } from './tema';
import { TemaProvider, useTheme, type TemaProviderProps } from './useTheme';

describe('resolverEsquema', () => {
  test.each([
    ['dark', 'sistema', 'escuro'],
    ['light', 'sistema', 'claro'],
    [null, 'sistema', 'claro'],
    ['dark', 'claro', 'claro'],
    ['light', 'escuro', 'escuro'],
  ] as const)('sistema %s, perfil %s => %s', (sis, pref, esperado) => {
    expect(resolverEsquema(sis, pref)).toBe(esperado);
  });
});

describe('reduzir movimento', () => {
  test('sistema OU perfil', () => {
    expect(resolverReduzirMovimento(false, false)).toBe(false);
    expect(resolverReduzirMovimento(true, false)).toBe(true);
    expect(resolverReduzirMovimento(false, true)).toBe(true);
  });
  test('constantes resolvem para 0 e sem loops, só o fade de 120 ms', () => {
    const r = resolverMovimento(true);
    expect([r.instant, r.quick, r.base, r.slow]).toEqual([0, 0, 0, 0]);
    expect(r.loops).toBe(false);
    expect(r.saltos).toBe(false);
    expect(r.fadeDeEstado).toBe(motion.reducedFade);
  });
  test('sem reduzir mantém os tokens', () => {
    const r = resolverMovimento(false);
    expect(r.base).toBe(motion.base);
    expect(r.loops).toBe(true);
    expect(r.landingSquash).toEqual(motion.landingSquash);
  });
});

describe('montarTema', () => {
  test('cores por esquema e ink de ação fixo', () => {
    expect(montarTema('escuro', false, false).cores).toBe(darkColors);
    expect(montarTema('claro', false, false).cores).toBe(lightColors);
    expect(montarTema('escuro', false, false).inkSobreAcao).toBe(lightColors.ink);
  });
});

describe('useTheme', () => {
  function ler(props: Partial<TemaProviderProps>) {
    let tema: ReturnType<typeof useTheme> | undefined;
    function Sonda() {
      tema = useTheme();
      return <span>ok</span>;
    }
    render(
      <TemaProvider raiz={false} {...props}>
        <Sonda />
      </TemaProvider>,
    );
    return tema!;
  }

  test('devolve o tema escuro quando o sistema é escuro', () => {
    expect((ler({ sistema: { esquema: 'dark' } })).esquema).toBe('escuro');
  });
  test('override do Perfil vale sobre o sistema', () => {
    expect((ler({ sistema: { esquema: 'dark' }, tema: 'claro' })).esquema).toBe('claro');
    expect((ler({ sistema: { esquema: 'light' }, tema: 'escuro' })).cores).toBe(darkColors);
  });
  test('flag do Perfil liga reduzir movimento mesmo sem o sistema', () => {
    const t = ler({ sistema: { reduzirMovimento: false }, reduzirMovimento: true });
    expect(t.reduzirMovimento).toBe(true);
    expect(t.movimento.loops).toBe(false);
  });
});

describe('styles.css', () => {
  // Os testes rodam a partir de apps/web.
  const css = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8').toLowerCase();
  const nomeCss = (nome: string) => nome.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`);

  test('cores claras e de ação batem com os tokens', () => {
    for (const [nome, valor] of Object.entries(lightColors)) {
      expect(css).toContain(`--pulo-${nomeCss(nome)}: ${valor.toLowerCase()};`);
    }
  });
  test('cores do rascunho batem com os tokens', () => {
    for (const [nome, valor] of Object.entries(drawingColors)) {
      expect(css).toContain(`--pulo-${nomeCss(nome)}: ${valor.toLowerCase()};`);
    }
  });
  test('cores escuras de fundo e texto batem com os tokens', () => {
    for (const nome of ['bg', 'surface', 'line', 'ink', 'muted'] as const) {
      expect(css).toContain(`--pulo-${nome}: ${darkColors[nome].toLowerCase()};`);
    }
  });
});
