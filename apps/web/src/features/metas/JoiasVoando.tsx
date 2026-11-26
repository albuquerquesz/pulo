import { useState, type CSSProperties } from 'react';

import { Joia } from '@/ui';

import type { Voo } from './voo';

/** No máximo tantas joias na tela, para o baú grande não virar uma nuvem. */
const MAXIMO_NA_TELA = 10;
const ATRASO_ENTRE_ELAS_MS = 70;

type EstiloDaJoia = CSSProperties & Record<`--${string}`, string>;

type JoiasVoandoProps = { voo: Voo; onTerminar: () => void };

/** As joias saem do baú e entram no saldo do topo. */
export function JoiasVoando({ voo, onTerminar }: JoiasVoandoProps) {
  const quantas = Math.min(voo.joias, MAXIMO_NA_TELA);
  const [chegaram, setChegaram] = useState(0);
  return (
    <div aria-hidden="true" data-testid="joias-voando" className="pointer-events-none fixed inset-0 z-40">
      {Array.from({ length: quantas }, (_, i) => {
        const estilo = {
          left: voo.de.x,
          top: voo.de.y,
          '--dx': `${voo.para.x - voo.de.x}px`,
          '--dy': `${voo.para.y - voo.de.y}px`,
          '--abre': `${(i - (quantas - 1) / 2) * 18}px`,
          animationDelay: `${i * ATRASO_ENTRE_ELAS_MS}ms`,
        } satisfies EstiloDaJoia;
        return (
          <span
            key={i}
            style={estilo}
            className="absolute animate-joia-entra opacity-0"
            onAnimationEnd={() => {
              if (chegaram + 1 === quantas) onTerminar();
              setChegaram((n) => n + 1);
            }}
          >
            <Joia largura={26} altura={30} contorno="branco" />
          </span>
        );
      })}
    </div>
  );
}
