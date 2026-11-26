import { arrastar, cameraInicial, pontoNaCena, viewBoxDe, zoomNoPonto, type LimitesDaCamera } from './camera';

const LIMITES: LimitesDaCamera = { cx: 400, cy: 400, w: 1400, wEstreito: 760, min: 450, max: 2400, x0: -300, x1: 1100, y0: -200, y1: 900 };
const CAIXA = { left: 10, top: 20, width: 1000, height: 500 };

describe('câmera', () => {
  test('começa mais perto em contêiner estreito', () => {
    expect(cameraInicial(LIMITES, { largura: 1000, altura: 500 }).w).toBe(1400);
    expect(cameraInicial(LIMITES, { largura: 390, altura: 700 }).w).toBe(760);
  });

  test('o viewBox segue a proporção do contêiner', () => {
    expect(viewBoxDe({ cx: 400, cy: 400, w: 1000 }, { largura: 1000, altura: 500 })).toBe('-100 150 1000 500');
  });

  test('o zoom mantém o ponto sob o ponteiro', () => {
    const camera = { cx: 400, cy: 400, w: 1400 };
    const ponteiro = { x: 260, y: 120 };
    const antes = pontoNaCena(camera, CAIXA, ponteiro);
    const depois = zoomNoPonto(camera, LIMITES, CAIXA, ponteiro, 1 / 1.1);
    expect(depois.w).toBeCloseTo(1400 / 1.1);
    expect(pontoNaCena(depois, CAIXA, ponteiro).x).toBeCloseTo(antes.x);
    expect(pontoNaCena(depois, CAIXA, ponteiro).y).toBeCloseTo(antes.y);
  });

  test('o zoom respeita o mínimo e o máximo', () => {
    const camera = { cx: 400, cy: 400, w: 1400 };
    expect(zoomNoPonto(camera, LIMITES, CAIXA, { x: 0, y: 0 }, 0.01).w).toBe(450);
    expect(zoomNoPonto(camera, LIMITES, CAIXA, { x: 0, y: 0 }, 100).w).toBe(2400);
  });

  test('arrastar anda na escala da tela e para nas bordas', () => {
    const camera = { cx: 400, cy: 400, w: 2000 };
    expect(arrastar(camera, LIMITES, 1000, 50, -25)).toEqual({ cx: 300, cy: 450, w: 2000 });
    expect(arrastar(camera, LIMITES, 1000, 9999, -9999)).toEqual({ cx: -300, cy: 900, w: 2000 });
  });
});
