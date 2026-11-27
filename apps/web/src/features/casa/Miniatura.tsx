import { useLayoutEffect, useRef } from 'react';

import { tintaDe, type Escolha } from './catalogo';

const FOLGA = 6;
/** Até a medição, o quarto inteiro. */
const QUARTO = '20 60 760 640';

/** O desenho de um modelo na loja, enquadrado no tamanho dele. */
export function Miniatura({ escolha }: { escolha: Escolha }) {
  const svg = useRef<SVGSVGElement>(null);
  const desenho = useRef<SVGGElement>(null);
  const { modelo } = escolha;
  useLayoutEffect(() => {
    const caixa = desenho.current?.getBBox?.();
    if (caixa?.width) svg.current?.setAttribute('viewBox', `${caixa.x - FOLGA} ${caixa.y - FOLGA} ${caixa.width + FOLGA * 2} ${caixa.height + FOLGA * 2}`);
  }, [modelo]);
  return (
    <svg ref={svg} viewBox={QUARTO} aria-hidden="true" className="h-12 w-full md:h-[70px]">
      <g ref={desenho}>
        <modelo.Desenho cor={tintaDe(escolha)} />
      </g>
    </svg>
  );
}
