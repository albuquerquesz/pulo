import { act, render, screen } from '@testing-library/react';

import { TemaProvider } from '@/theme';

import { ROSTO_DO_ESTADO, rotuloDoSapo } from './machine';
import { HUMOR_DO_MOMENTO } from './momentos';
import { Sapo } from './sapo/Sapo';
import { VIDA, esperaDaPiscada, sorteio } from './sapo/vida';

const piscadas = (semente: number, quantas: number) => {
  const proximo = sorteio(semente);
  return Array.from({ length: quantas }, () => esperaDaPiscada(proximo));
};

const svg = () => screen.getByTestId('sapo').querySelector('svg')?.getAttribute('class') ?? '';
const andar = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe('momentos', () => {
  it('todo momento tem um humor com rosto', () => {
    for (const humor of Object.values(HUMOR_DO_MOMENTO)) expect(ROSTO_DO_ESTADO[humor]).toBeDefined();
  });

  it('o momento escolhe o humor do sapo', () => {
    render(<Sapo fase={1} momento="gelo-gasto" />);
    expect(screen.getByRole('img', { name: rotuloDoSapo('congelado') })).toBeDefined();
    expect(screen.getByTestId('peca-cachecol')).toBeDefined();
  });

  it.each([
    ['sem-sinal', 'peca-antena'],
    ['erro', 'peca-interrogacao'],
    ['conquista', 'peca-confete'],
    ['compra-na-ilha', 'peca-martelo'],
    ['sequencia-perdida', 'peca-gota'],
  ] as const)('%s desenha o que segura ou o extra', (momento, peca) => {
    render(<Sapo fase={4} momento={momento} />);
    expect(screen.getByTestId(peca)).toBeDefined();
  });
});

describe('vida parada', () => {
  afterEach(() => vi.useRealTimers());

  it('a mesma semente dá a mesma sequência, entre 3 e 6 segundos', () => {
    expect(piscadas(7, 4)).toEqual([3035, 3186, 5931, 5097]);
    for (const ms of piscadas(1, 200)) {
      expect(ms).toBeGreaterThanOrEqual(VIDA.piscadaMinMs);
      expect(ms).toBeLessThanOrEqual(VIDA.piscadaMaxMs);
    }
  });

  it('pisca na hora sorteada e olha de lado a cada 15 segundos', () => {
    vi.useFakeTimers();
    const [primeira = 0] = piscadas(7, 1);
    render(<Sapo fase={4} semente={7} reducedMotion={false} />);
    andar(primeira - 1);
    expect(svg()).not.toContain('sapo-piscando');
    andar(1);
    expect(svg()).toContain('sapo-piscando');
    andar(VIDA.piscadaDuraMs);
    expect(svg()).not.toContain('sapo-piscando');
    andar(VIDA.olharACadaMs - VIDA.olharDuraMs - primeira - VIDA.piscadaDuraMs);
    expect(svg()).toContain('sapo-de-lado');
  });

  it('com movimento reduzido, nada se mexe', () => {
    vi.useFakeTimers();
    render(
      <TemaProvider raiz={false} reduzirMovimento>
        <Sapo fase={4} semente={7} />
      </TemaProvider>,
    );
    andar(VIDA.olharACadaMs * 2);
    expect(svg()).toBe('sapo-svg');
    expect(vi.getTimerCount()).toBe(0);
  });
});
