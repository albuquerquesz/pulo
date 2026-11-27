import type { Ref } from 'react';

import { SapoPulando } from '@/mascot';

/**
 * O sapo do quarto, de corpo inteiro, nas medidas do rascunho (coordenadas do cômodo). No foco ele passeia pelo
 * quarto aos pulinhos, tudo no CSS (`.cena-casa.focando`).
 */
export function SapoDaCasa({ ref }: { ref?: Ref<SVGGElement> }) {
  return (
    <g className="sapo-casa pointer-events-none" data-testid="sapo-da-casa" transform="translate(400,562) scale(0.97)" aria-hidden="true">
      <g ref={ref} className="anda">
        <g className="corpo-q">
          <SapoPulando x={-65} y={-112} width={130} />
        </g>
      </g>
    </g>
  );
}
