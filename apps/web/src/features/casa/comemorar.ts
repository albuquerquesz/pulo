import { animar, apoiarEm, efeito, esperar, type CaixaDoDesenho } from '@/ui/compra';

/** O meio do quarto, de onde o sapo olha. */
const MEIO = 400;
const CORACAO = 'M400 430c-6-8-18-6-18 4 0 9 12 15 18 20 6-5 18-11 18-20 0-10-12-12-18-4z';

/** O sapo olha para o que chegou, dá um pulinho de alegria e solta um coração. */
export async function comemorar(sapo: Element, camada: Element, caixa: CaixaDoDesenho): Promise<void> {
  const lado = Math.max(-1, Math.min(1, (caixa.x + caixa.width / 2 - MEIO) / 160));
  const olhando = `translate(${lado * 9}px, -2px)`;
  for (const parte of sapo.querySelectorAll('.sp-olho ellipse ~ ellipse')) {
    void animar(
      parte,
      [{ transform: 'translate(0,0)' }, { transform: olhando, offset: 0.2 }, { transform: olhando, offset: 0.8 }, { transform: 'translate(0,0)' }],
      { duration: 1500, easing: 'ease-in-out' },
    );
  }
  await esperar(180);
  const corpo = sapo.querySelector<SVGGElement>('.sp-corpo');
  const sombra = sapo.querySelector<SVGEllipseElement>('.sp-sombra');
  if (corpo) {
    apoiarEm(corpo, '50% 100%');
    // Nas unidades do desenho do sapo.
    void animar(
      corpo,
      [
        { transform: 'translateY(0) scale(1, 1)' },
        { transform: 'translateY(0) scale(1.1, .88)', offset: 0.18 },
        { transform: 'translateY(-81px) scale(.94, 1.08)', offset: 0.45 },
        { transform: 'translateY(0) scale(1.08, .92)', offset: 0.72 },
        { transform: 'translateY(0) scale(1, 1)' },
      ],
      { duration: 620, easing: 'ease-in-out' },
    );
  }
  if (sombra) {
    apoiarEm(sombra, 'center');
    void animar(sombra, [{ transform: 'scale(1)' }, { transform: 'scale(.65)', offset: 0.45 }, { transform: 'scale(1)' }], { duration: 620, easing: 'ease-in-out' });
  }
  void efeito(
    camada,
    'path',
    { d: CORACAO, fill: '#ff7a8f', stroke: '#3b2a2f', 'stroke-width': 2.5 },
    [
      { transform: 'translateY(0) scale(0)', opacity: 1 },
      { transform: 'translateY(-26px) scale(1.15)', opacity: 1, offset: 0.4 },
      { transform: 'translateY(-54px) scale(.9)', opacity: 0 },
    ],
    { duration: 1200, delay: 260, easing: 'ease-out' },
    '50% 100%',
  );
}
