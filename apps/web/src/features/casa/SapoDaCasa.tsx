import type { Ref } from 'react';

const TRACO = { stroke: 'var(--pulo-contorno)', strokeWidth: 4.5 } as const;
const PE = { fill: '#6CC23F', stroke: 'var(--pulo-contorno)', strokeWidth: 4 } as const;

/** O sapo de contorno grosso do quarto. O passeio e os pulinhos são do CSS (`.cena-casa.focando`). */
export function SapoDaCasa({ ref }: { ref?: Ref<SVGGElement> }) {
  return (
    <g className="sapo-casa pointer-events-none" data-testid="sapo-da-casa" transform="translate(400,560) scale(1.5)" aria-hidden="true">
      <g ref={ref} className="anda">
        <g className="corpo-q">
          <ellipse cx="0" cy="4" rx="46" ry="12" fill="rgba(59,42,47,.18)" />
          <ellipse cx="-24" cy="-4" rx="17" ry="9" {...PE} />
          <ellipse cx="24" cy="-4" rx="17" ry="9" {...PE} />
          <path d="M-40-30C-44-70-24-92 0-92S44-70 40-30C38-8 22 0 0 0S-38-8-40-30Z" fill="#8FDC5E" {...TRACO} />
          <path d="M-22-22C-22-44 22-44 22-22C22-8 10-4 0-4S-22-8-22-22Z" fill="#E9FBD5" />
          <circle cx="-19" cy="-88" r="15" fill="#8FDC5E" {...TRACO} />
          <circle cx="19" cy="-88" r="15" fill="#8FDC5E" {...TRACO} />
          <circle cx="-18" cy="-88" r="6" fill="var(--pulo-contorno)" />
          <circle cx="20" cy="-88" r="6" fill="var(--pulo-contorno)" />
          <circle cx="-16" cy="-90" r="2" fill="#fff" />
          <circle cx="22" cy="-90" r="2" fill="#fff" />
          <ellipse cx="-27" cy="-64" rx="7" ry="4" fill="#FF9DB4" />
          <ellipse cx="27" cy="-64" rx="7" ry="4" fill="#FF9DB4" />
          <path d="M-9-64q9 8 18 0" fill="none" stroke="var(--pulo-contorno)" strokeWidth="4" strokeLinecap="round" />
          <path d="M-38-34q-14 8-10 22M38-34q14 8 10 22" fill="none" strokeLinecap="round" {...TRACO} />
        </g>
      </g>
    </g>
  );
}
