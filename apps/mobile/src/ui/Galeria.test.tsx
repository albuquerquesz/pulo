jest.mock('react-native-reanimated', () => require('./testing/reanimated-mock'));

import { act } from 'react';
import { createRoot } from 'test-renderer';

import type { FrogMood, Phase } from '@pulo/core/domain/types';
import { Sapo } from '@/mascot/sapo/Sapo';
import { Lagoa } from '@/mascot/lagoa/Lagoa';
import { TemaProvider } from '@/theme/useTheme';

import { descricaoDoAnel, formatarTempo } from './AnelTimer';
import { Galeria } from './Galeria';

async function montar(el: React.ReactElement) {
  const root = createRoot();
  await act(async () => {
    root.render(el);
  });
  return root;
}

describe('renderização', () => {
  test('a galeria renderiza todos os componentes em todos os estados, sem erro', async () => {
    const root = await montar(
      <TemaProvider carregarFontes={false}>
        <Galeria />
      </TemaProvider>,
    );
    expect(root.container.queryAll((n) => n.props?.testID === 'galeria-claro').length).toBeGreaterThan(0);
    expect(root.container.queryAll((n) => n.props?.testID === 'galeria-escuro').length).toBeGreaterThan(0);
    await act(async () => root.unmount());
  });

  test('o sapo tem rótulo "Sapo, <estado>" e fases 1 e 2 caem para parado', async () => {
    const estados: FrogMood[] = ['parado', 'feliz', 'cansado', 'pensando', 'surpreso', 'focado', 'dormindo', 'pouso'];
    for (const fase of [1, 2, 3, 4] as Phase[]) {
      for (const estado of estados) {
        const root = await montar(
          <TemaProvider carregarFontes={false} sistema={{ reduzirMovimento: true }}>
            <Sapo fase={fase} estado={estado} />
          </TemaProvider>,
        );
        const no = root.container.queryAll((n) => n.props?.testID === 'sapo')[0];
        const rotulo = no.props.accessibilityLabel as string;
        expect(rotulo).toMatch(/^Sapo, /);
        if (fase <= 2 && !['parado', 'feliz', 'cansado'].includes(estado)) expect(rotulo).toBe('Sapo, parado');
        await act(async () => root.unmount());
      }
    }
  });

  test('a lagoa renderiza as 4 fases', async () => {
    for (const fase of [1, 2, 3, 4] as Phase[]) {
      const root = await montar(
        <TemaProvider carregarFontes={false}>
          <Lagoa fase={fase} resumo={{ careDays: 5, stable: true }} agora={{ diasDeCuidadoTotal: 20, dentroDoDia: false, descansoHoje: true }} />
        </TemaProvider>,
      );
      expect(root.container.queryAll((n) => n.props?.testID === 'lagoa').length).toBe(1);
      await act(async () => root.unmount());
    }
  });
});

describe('AnelTimer helpers', () => {
  test('formata o tempo', () => {
    expect(formatarTempo(25 * 60000)).toBe('25:00');
    expect(formatarTempo(61_000)).toBe('01:01');
    expect(formatarTempo(-5)).toBe('00:00');
  });
  test('descrição em português', () => {
    expect(descricaoDoAnel(90_000, 'rodando')).toContain('1 minutos e 30 segundos');
    expect(descricaoDoAnel(0, 'concluido')).toContain('concluído');
  });
});
