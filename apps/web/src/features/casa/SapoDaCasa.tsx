import type { Ref } from 'react';

import { SapoPulando } from '@/mascot';

/** O sapo do quarto, de corpo inteiro. No foco ele passeia pelo quarto aos pulinhos, tudo no CSS (`.cena-casa.focando`). */
export function SapoDaCasa({ ref }: { ref?: Ref<SVGGElement> }) {
  return (
    <g className="sapo-casa pointer-events-none" data-testid="sapo-da-casa" transform="translate(400,560) scale(1.5)" aria-hidden="true">
      <g ref={ref} className="anda">
        <g className="corpo-q">
          <SapoPulando x={-65} y={-112} width={130} />
        </g>
      </g>
    </g>
  );
}
