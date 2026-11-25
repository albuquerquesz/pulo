import type { KeyboardEvent } from 'react';

import { cor, mistura } from '../cores';
import { caixa, projetar, type Ponto3d } from './geometria';
import { CONTORNO, GRAMA, MADEIRA, PEDRA } from './paleta';
import { Faces } from './pecas';

/*
 * O acesso para a próxima ilha: um cais que sai da beira da grama, um arco de madeira e, ao longe, a próxima ilha.
 * Trancado (corrente e cadeado, ilha apagada) até a casa ficar inteira.
 */

const CAIS = { u: [7.4, 9.6], v: [-2.2, -1.2], z: [-0.22, 0] } as const;
const ARCO_U = [8.3, 8.5] as const;
const PILAR_ESQ = { u: ARCO_U, v: [-2.45, -2.25], z: [0, 2.3] } as const;
const PILAR_DIR = { u: ARCO_U, v: [-1.15, -0.95], z: [0, 2.3] } as const;
const VIGA = { u: [8.25, 8.55], v: [-2.6, -0.8], z: [2.3, 2.6] } as const;
const ESTACAS = [8.8, 9.35] as const;
const PROXIMA = { u: [10.3, 11.9], v: [-2.7, -0.7], z: [-0.9, 0] } as const;

const linha = (de: Ponto3d, ate: Ponto3d) => {
  const a = projetar(de);
  const b = projetar(ate);
  return `M${a.x} ${a.y}L${b.x} ${b.y}`;
};

function Cadeado() {
  const { x, y } = projetar([8.4, -1.7, 1.05]);
  return (
    <g data-testid="cadeado" transform={`translate(${x},${y})`}>
      <path d="M-7-4v-6a7 7 0 0 1 14 0v6" fill="none" stroke={CONTORNO} strokeWidth="4" strokeLinecap="round" />
      <rect x="-11" y="-5" width="22" height="18" rx="4" fill={cor('sol')} stroke={CONTORNO} strokeWidth="3.5" />
      <circle cx="0" cy="3" r="2.6" fill={CONTORNO} />
    </g>
  );
}

function Corrente() {
  // Duas voltas de corrente entre os pilares, presas no cadeado.
  const elos = [
    linha([8.4, -2.3, 1.7], [8.4, -1.7, 1.15]),
    linha([8.4, -1.7, 1.15], [8.4, -1.1, 1.7]),
    linha([8.4, -2.3, 0.6], [8.4, -1.7, 1]),
    linha([8.4, -1.7, 1], [8.4, -1.1, 0.6]),
  ];
  return elos.map((d) => <path key={d} d={d} fill="none" stroke={cor('etiqueta-cinza')} strokeWidth="5" strokeDasharray="7 3" strokeLinecap="round" />);
}

type PortalProps = { aberto: boolean; onToque?: () => void };

/** O cais para a próxima ilha. Tocar avisa o que falta (ou que abre em breve). */
export function PortalDaProximaIlha({ aberto, onToque }: PortalProps) {
  const rotulo = aberto ? 'Caminho para a próxima ilha, aberto' : 'Caminho para a próxima ilha, trancado';
  return (
    <g
      data-testid="portal"
      className={`portal-da-ilha ${aberto ? 'aberto' : 'trancado'}`}
      // Na miniatura (sem toque) é só desenho.
      {...(onToque
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-label': rotulo,
            onClick: onToque,
            onKeyDown: (e: KeyboardEvent<SVGGElement>) => {
              if (e.key === 'Enter' || e.key === ' ') onToque();
            },
          }
        : {})}
    >
      <g className="proxima-ilha">
        <Faces faces={caixa(PROXIMA, { esquerda: MADEIRA.direita, direita: MADEIRA.esquerda, topo: GRAMA })} />
        <Faces faces={caixa({ u: [10.9, 11.4], v: [-1.9, -1.4], z: [0, 0.9] }, { esquerda: mistura('timer-verde-borda', 80, 'contorno'), direita: cor('timer-verde-borda'), topo: cor('timer-verde') })} traco={3} />
      </g>
      {ESTACAS.map((u) => (
        <Faces key={u} faces={caixa({ u: [u, u + 0.18], v: [-1.4, -1.22], z: [-1.4, -0.22] }, MADEIRA)} traco={3} />
      ))}
      <Faces faces={caixa(CAIS, MADEIRA)} />
      {[8, 8.6, 9.2].map((u) => (
        <path key={u} d={linha([u, -2.2, 0], [u, -1.2, 0])} stroke={mistura('madeira-escura', 70, 'contorno')} strokeWidth="2.5" />
      ))}
      <Faces faces={caixa(PILAR_ESQ, PEDRA)} traco={3.5} />
      <Faces faces={caixa(PILAR_DIR, PEDRA)} traco={3.5} />
      <Faces faces={caixa(VIGA, MADEIRA)} traco={3.5} />
      {aberto ? null : (
        <>
          <Corrente />
          <Cadeado />
        </>
      )}
    </g>
  );
}
