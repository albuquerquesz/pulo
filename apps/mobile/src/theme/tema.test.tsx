import { act } from 'react';
import { Text } from 'react-native';
import { createRoot } from 'test-renderer';

import { darkColors, lightColors, motion } from './tokens';
import { montarTema, resolverEsquema, resolverMovimento, resolverReduzirMovimento } from './tema';
import { TemaProvider, useTheme } from './useTheme';

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
  async function ler(props: Parameters<typeof TemaProvider>[0] extends infer P ? Partial<P> : never) {
    let tema: ReturnType<typeof useTheme> | undefined;
    function Sonda() {
      tema = useTheme();
      return <Text>ok</Text>;
    }
    const root = createRoot();
    await act(async () => {
      root.render(
        <TemaProvider carregarFontes={false} {...props}>
          <Sonda />
        </TemaProvider>,
      );
    });
    return tema!;
  }

  test('devolve o tema escuro quando o sistema é escuro', async () => {
    expect((await ler({ sistema: { esquema: 'dark' } })).esquema).toBe('escuro');
  });
  test('override do Perfil vale sobre o sistema', async () => {
    expect((await ler({ sistema: { esquema: 'dark' }, tema: 'claro' })).esquema).toBe('claro');
    expect((await ler({ sistema: { esquema: 'light' }, tema: 'escuro' })).cores).toBe(darkColors);
  });
  test('flag do Perfil liga reduzir movimento mesmo sem o sistema', async () => {
    const t = await ler({ sistema: { reduzirMovimento: false }, reduzirMovimento: true });
    expect(t.reduzirMovimento).toBe(true);
    expect(t.movimento.loops).toBe(false);
  });
});
