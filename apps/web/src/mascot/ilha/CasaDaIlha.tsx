import type { ReactNode, SVGProps } from 'react';

import type { ParteId } from '@pulo/core/domain/casa';

import { caixa, face, naParedeDireita, naParedeEsquerda, projetar, telhado, type Face, type Intervalo } from './geometria';

/*
 * Ilha com a casa, portada do rascunho (public/rascunhos/desktop.html, `.casa-svg`).
 * A mesma arte serve à tela da Ilha e à miniatura do trilho.
 */

const CONTORNO = '#3B2A2F';
const PAREDE = { esquerda: '#EADBB4', direita: '#F7E6C8' };
const TELHADO = { fundo: '#D9A04A', empena: '#F2D79A', frente: '#E9B85A' };
const MADEIRA = { esquerda: '#B07A4E', direita: '#C98B5E' };
const VIDRO = '#BFEFFF';

function Faces({ faces }: { faces: readonly Face[] }) {
  return faces.map((f) => <polygon key={f.pontos} points={f.pontos} fill={f.cor} stroke={CONTORNO} strokeWidth="4" strokeLinejoin="round" />);
}

const PEDRAS = [1.3, 2.3, 3.3, 4.3].map((v) => projetar([-1.6, v, 0]));

const TERRENO = (
  <>
    <Faces faces={caixa({ u: [-5, 5], v: [-5, 5], z: [-1.3, 0] }, { esquerda: '#C98B5E', direita: '#B07A4E', topo: '#A8D86E' })} />
    {PEDRAS.map(({ x, y }) => (
      <ellipse key={x} cx={x} cy={y} rx="14" ry="7" fill="#D9D3C2" stroke={CONTORNO} strokeWidth="3" />
    ))}
  </>
);

function Arvore() {
  const { x, y } = projetar([3.3, -3.4, 0]);
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse rx="34" ry="12" fill="rgba(59,42,47,.18)" />
      <path d="M-8 0v-70h16v70z" fill="#8B5A2B" stroke={CONTORNO} strokeWidth="4" />
      <circle cx="0" cy="-100" r="52" fill="#6FCB55" stroke={CONTORNO} strokeWidth="4" />
      <circle cx="-34" cy="-74" r="30" fill="#5DBB46" stroke={CONTORNO} strokeWidth="4" />
      <circle cx="34" cy="-74" r="30" fill="#5DBB46" stroke={CONTORNO} strokeWidth="4" />
    </g>
  );
}

const FLORES: readonly [u: number, v: number, cor: string][] = [
  [1.6, 1.4, '#FF9DB4'],
  [2.4, 1.9, '#FFD166'],
  [3.2, 1.5, '#B583FF'],
  [2, 2.8, '#FF9DB4'],
  [3, 2.7, '#FFD166'],
  [3.8, 2.4, '#FF8FC7'],
];

const POSTE_DA_VARANDA = (u: Intervalo) =>
  caixa({ u, v: [1.45, 1.6], z: [0, 1.6] }, { ...MADEIRA, topo: MADEIRA.direita });

const POSTES_DA_CERCA = Array.from({ length: 10 }, (_, i) => -4.4 + i * 0.9);

/** As partes na ordem de desenho (de trás para a frente). */
const ORDEM: readonly ParteId[] = ['arvore', 'quarto', 'cozinha', 'varanda', 'jardim', 'cerca'];

const ARTE: Record<ParteId, ReactNode> = {
  arvore: <Arvore />,
  quarto: (
    <Faces
      faces={[
        ...caixa({ u: [-3, 0], v: [-3, 0], z: [0, 2.6] }, PAREDE),
        ...telhado({ u: [-3, 0], v: [-3, 0], z: [2.6, 4] }, TELHADO),
        // Porta e janelas.
        naParedeEsquerda('#4FA3C9', 0, [-2, -1.2], [0, 1.5]),
        naParedeDireita(VIDRO, 0, [-2, -1], [1, 1.9]),
        naParedeEsquerda(VIDRO, 0, [-0.9, -0.2], [1.1, 1.8]),
      ]}
    />
  ),
  cozinha: (
    <Faces
      faces={[
        ...caixa({ u: [0, 2.6], v: [-2.6, -0.4], z: [0, 2.2] }, PAREDE),
        ...telhado({ u: [0, 2.6], v: [-2.6, -0.4], z: [2.2, 3.3] }, TELHADO),
        naParedeDireita(VIDRO, 2.6, [-2, -1], [1, 1.8]),
        naParedeEsquerda(VIDRO, -0.4, [0.8, 1.7], [1, 1.8]),
      ]}
    />
  ),
  varanda: (
    <Faces
      faces={[
        ...caixa({ u: [-3.8, -2.4], v: [0, 1.6], z: [0, 0.3] }, { ...MADEIRA, topo: '#D9A46E' }),
        ...POSTE_DA_VARANDA([-3.8, -3.65]),
        ...POSTE_DA_VARANDA([-2.55, -2.4]),
      ]}
    />
  ),
  jardim: FLORES.map(([u, v, cor]) => {
    const { x, y } = projetar([u, v, 0]);
    return (
      <g key={x} transform={`translate(${x},${y})`}>
        <path d="M0 0v-16" stroke="#3F8F23" strokeWidth="3" />
        <circle cy="-18" r="7" fill={cor} stroke={CONTORNO} strokeWidth="3" />
      </g>
    );
  }),
  cerca: (
    <Faces
      faces={[
        ...POSTES_DA_CERCA.flatMap((u) => caixa({ u: [u, u + 0.12], v: [4.4, 4.52], z: [0, 0.8] }, { ...PAREDE, topo: '#fff' })),
        // A travessa passa na frente dos postes.
        face('#fff', [
          [-4.4, 4.52, 0.55],
          [4.6, 4.52, 0.55],
          [4.6, 4.52, 0.7],
          [-4.4, 4.52, 0.7],
        ]),
      ]}
    />
  ),
};

type CasaDaIlhaProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  /** Partes já construídas; as outras aparecem tracejadas. */
  construidas: readonly ParteId[];
  /** A parte recém comprada, que cai do alto. */
  nova?: ParteId | null;
  rotulo?: string;
};

export function CasaDaIlha({ construidas, nova, viewBox = '60 60 880 860', rotulo = 'Sua ilha', ...svg }: CasaDaIlhaProps) {
  return (
    <svg {...svg} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={rotulo}>
      {TERRENO}
      {ORDEM.map((id) => (
        <g key={id} data-parte={id} className={['parte-da-casa', construidas.includes(id) ? 'feita' : '', nova === id ? 'nova' : ''].filter(Boolean).join(' ')}>
          {ARTE[id]}
        </g>
      ))}
    </svg>
  );
}
