import { useId } from 'react';

const FAIXAS = ['n1', 'n2', 'n3', 'n4', 'n5'] as const;
const CONTORNO =
  'M52 150C18 150 6 116 28 98C12 70 38 44 70 54C76 22 118 6 148 28C168 2 222 4 234 42C268 34 300 60 290 92C318 104 308 150 274 150Z';

/**
 * Camada de nuvens com rabiscos atrás da cena (o pai precisa de `relative overflow-hidden`; a cena fica com `relative z-1`).
 * Cada nuvem voa na sua faixa, sem cruzar as outras; com movimento reduzido, ficam paradas (styles.css).
 */
export function Nuvens() {
  const nuvem = useId();
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <svg width="0" height="0" className="absolute">
        <symbol id={nuvem} viewBox="0 0 320 170">
          <path d={CONTORNO} fill="#E2EEF3" transform="translate(4 10)" />
          <path d={CONTORNO} fill="#FDFEFF" />
          <g fill="none" stroke="#EBDDE8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M96 78c8-12 22-8 20 2s-14 10-12 2" strokeWidth="4" />
            <path d="M172 124c10 6 22 2 20-8s-12-6-10 2" strokeWidth="4" />
            <path d="M226 74l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" strokeWidth="3.5" />
            <path d="M252 104l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" strokeWidth="3" />
          </g>
        </symbol>
      </svg>
      {FAIXAS.map((faixa) => (
        <svg key={faixa} data-testid="nuvem" className={`nv ${faixa}`} viewBox="0 0 320 170">
          <use href={`#${nuvem}`} />
        </svg>
      ))}
    </div>
  );
}
