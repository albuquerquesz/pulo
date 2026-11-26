import type { ReactNode } from 'react';

import type { ParteId } from '@pulo/core/domain/casa';

import { cor, mistura } from '../cores';
import type { Arte } from './construcao';
import { caixa, circuloNoChao, face, projetar, telhado, type Intervalo, type Ponto3d } from './geometria';
import { AGUA, CONTORNO, ESPUMA, FOLHAGEM, FOLHAGEM_ESCURA, MADEIRA, PAREDE, PEDRA, VIDRO } from './paleta';
import { Faces } from './pecas';

/* O quintal: o que fica ao redor da mansão. */

const NO_CHAO = (u: number, v: number) => projetar([u, v, 0]);
const TRACO = { stroke: CONTORNO, strokeWidth: 4, strokeLinejoin: 'round' } as const;

const PE_DA_ARVORE = NO_CHAO(3.3, -3.4);
const EM_PE = ({ x, y }: { x: number; y: number }, children: ReactNode) => <g transform={`translate(${x},${y})`}>{children}</g>;

const FLORES: readonly [u: number, v: number, cor: string][] = [
  [1.6, 1.7, cor('etiqueta-rosa')],
  [2.4, 2.2, cor('sol')],
  [3.2, 1.8, cor('joia')],
  [2, 3.1, cor('etiqueta-rosa')],
  [3, 3, cor('sol')],
  [3.8, 2.7, cor('cancelar')],
];

const POSTE_DA_VARANDA = (u: Intervalo) => caixa({ u, v: [1.45, 1.6], z: [0, 1.6] }, MADEIRA);
const POSTES_DA_CERCA = Array.from({ length: 10 }, (_, i) => -4.4 + i * 0.9);

type Par = readonly [number, number];

const CANTEIROS: readonly Intervalo[] = [
  [-1.15, -0.65],
  [-0.4, 0.1],
  [0.35, 0.85],
];
const MUDAS = [4.75, 5.35, 5.95, 6.5];

const retangulo = (preenchimento: string, [u0, u1]: Intervalo, [v0, v1]: Intervalo, z: number) =>
  face(preenchimento, [
    [u0, v0, z],
    [u1, v0, z],
    [u1, v1, z],
    [u0, v1, z],
  ]);

const linha = (...pontos: Ponto3d[]) =>
  pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${projetar(p).x} ${projetar(p).y}`).join('');

function Ondas({ u, v, quantas }: { u: number; v: number; quantas: readonly (readonly [number, number])[] }) {
  const { x, y } = NO_CHAO(u, v);
  return (
    <g transform={`translate(${x},${y})`}>
      {quantas.map(([dx, dy], i) => (
        <path
          key={`${dx} ${dy}`}
          className="onda"
          d={`M${dx - 16} ${dy}q8-7 16 0t16 0`}
          fill="none"
          stroke={ESPUMA}
          strokeWidth="3.5"
          strokeLinecap="round"
          style={{ animationDelay: `${-i * 0.7}s` }}
        />
      ))}
    </g>
  );
}

const ESCADA_DA_PISCINA = [-6.9, -6.45].map((u) => linha([u, 2.1, 0.1], [u, 2.1, 0.75], [u, 2.35, 0.75], [u, 2.35, 0.22])).join('');

const VITORIAS_REGIAS: readonly Par[] = [
  [-6.7, 5.1],
  [-5.4, 6.1],
];
const MACAS: readonly Par[] = [
  [-16, -126],
  [20, -100],
  [-30, -86],
];
/** Os dois trechos da travessa, com o vão do caminho no meio. */
const TRAVESSAS: readonly Par[] = [
  [-4.4, -2.1],
  [-1.1, 4.6],
];

/** A ponte em arco sobre o lago: tábuas e corrimão. */
function Ponte() {
  const de = projetar([-7.9, 5.9, 0.1]);
  const ate = projetar([-4.2, 5.9, 0.1]);
  const meio = projetar([-6.05, 5.9, 1.5]);
  const arco = (sobe: number) => `M${de.x} ${de.y - sobe}Q${meio.x} ${meio.y - sobe} ${ate.x} ${ate.y - sobe}`;
  const balaustres = [0.15, 0.38, 0.62, 0.85].map((t) => ({
    x: (1 - t) ** 2 * de.x + 2 * t * (1 - t) * meio.x + t ** 2 * ate.x,
    y: (1 - t) ** 2 * de.y + 2 * t * (1 - t) * meio.y + t ** 2 * ate.y,
  }));
  return (
    <>
      <path d={arco(0)} fill="none" stroke={CONTORNO} strokeWidth="24" strokeLinecap="round" />
      <path d={arco(0)} fill="none" stroke={cor('madeira-clara')} strokeWidth="16" strokeLinecap="round" />
      <path d={arco(0)} fill="none" stroke={CONTORNO} strokeWidth="16" strokeDasharray="2 14" opacity=".35" />
      <path d={balaustres.map(({ x, y }) => `M${x} ${y - 6}v-24`).join('')} stroke={CONTORNO} strokeWidth="5" />
      <path d={arco(32)} fill="none" stroke={CONTORNO} strokeWidth="9" strokeLinecap="round" />
      <path d={arco(32)} fill="none" stroke={cor('cancelar')} strokeWidth="4" strokeLinecap="round" />
    </>
  );
}

export const ARTE_DO_EXTERIOR = {
  arvore: () =>
    EM_PE(
      PE_DA_ARVORE,
      <>
        <ellipse rx="34" ry="12" fill={CONTORNO} opacity=".18" />
        <path d="M-8 0v-70h16v70z" fill={cor('madeira-escura')} {...TRACO} />
        <circle cx="0" cy="-104" r="52" fill={FOLHAGEM} {...TRACO} />
        <circle cx="-34" cy="-78" r="30" fill={FOLHAGEM_ESCURA} {...TRACO} />
        <circle cx="34" cy="-78" r="30" fill={FOLHAGEM_ESCURA} {...TRACO} />
        {MACAS.map(([cx, cy]) => (
          <circle key={cx} cx={cx} cy={cy} r="6" fill={cor('cancelar')} stroke={CONTORNO} strokeWidth="2.5" />
        ))}
      </>,
    ),
  balanco: () =>
    EM_PE(
      PE_DA_ARVORE,
      <>
        <path d="M4-62Q46-74 108-70" fill="none" stroke={CONTORNO} strokeWidth="14" strokeLinecap="round" />
        <path d="M4-62Q46-74 108-70" fill="none" stroke={cor('madeira-escura')} strokeWidth="7" strokeLinecap="round" />
        <g transform="translate(86,-70)">
          <g className="balanca">
            <path d="M-13 0V52M13 0V52" stroke={CONTORNO} strokeWidth="3" />
            <rect x="-21" y="50" width="42" height="11" rx="4" fill={cor('foco')} stroke={CONTORNO} strokeWidth="3.5" />
          </g>
        </g>
      </>,
    ),
  varanda: () => (
    <>
      <Faces faces={caixa({ u: [-3.8, -2.4], v: [0, 1.6], z: [0, 0.3] }, MADEIRA)} />
      <Faces faces={[...POSTE_DA_VARANDA([-3.8, -3.65]), ...POSTE_DA_VARANDA([-2.55, -2.4])]} />
      <Faces faces={caixa({ u: [-3.95, -2.25], v: [0, 1.75], z: [1.6, 1.78] }, { esquerda: cor('cancelar-borda'), direita: cor('cancelar'), topo: mistura('cancelar', 60, 'creme') })} />
    </>
  ),
  jardim: () =>
    FLORES.map(([u, v, petala]) => {
      const { x, y } = NO_CHAO(u, v);
      return (
        <g key={`${u} ${v}`} transform={`translate(${x},${y})`}>
          <path d="M0 0v-16M0-5q-9-1-11-9M0-8q9-1 11-9" fill="none" stroke={FOLHAGEM_ESCURA} strokeWidth="3" strokeLinecap="round" />
          <circle cy="-19" r="8" fill={petala} stroke={CONTORNO} strokeWidth="3" />
          <circle cy="-19" r="2.5" fill={cor('folha')} />
        </g>
      );
    }),
  horta: () => (
    <>
      <Faces faces={[retangulo(cor('madeira-clara'), [4.4, 6.8], [-1.35, 1.05], 0)]} />
      {CANTEIROS.map((v, linhaDoCanteiro) => (
        <g key={v[0]}>
          <Faces faces={caixa({ u: [4.5, 6.7], v, z: [0, 0.16] }, { esquerda: mistura('madeira-escura', 70, 'contorno'), direita: cor('madeira-escura'), topo: mistura('madeira-escura', 80, 'madeira') })} traco={3} />
          {MUDAS.map((u) => {
            const { x, y } = projetar([u, (v[0] + v[1]) / 2, 0.16]);
            return (
              <g key={u} transform={`translate(${x},${y})`}>
                <path d="M0-3q-11-3-9-14 9 2 9 11 0-9 9-11 2 11-9 14" fill={FOLHAGEM} stroke={CONTORNO} strokeWidth="2" strokeLinejoin="round" />
                <circle cy="-1" r="4" fill={linhaDoCanteiro === 1 ? cor('joia') : cor('foco')} stroke={CONTORNO} strokeWidth="2" />
              </g>
            );
          })}
        </g>
      ))}
    </>
  ),
  estufa: () => {
    const volume = { u: [5.4, 7.5], v: [2.5, 4.3], z: [0, 1.5] } as const;
    const vidros = [
      ...caixa(volume, { esquerda: VIDRO, direita: ESPUMA }),
      ...telhado({ ...volume, z: [1.5, 2.5] }, { fundo: VIDRO, empena: ESPUMA, frente: VIDRO }),
    ];
    return (
      <>
        <Faces faces={caixa({ ...volume, z: [0, 0.25] }, PEDRA)} traco={3} />
        {[5.9, 6.6, 7.1].map((u) => {
          const { x, y } = projetar([u, 3.8, 0.55]);
          return <circle key={u} cx={x} cy={y} r="14" fill={FOLHAGEM} stroke={CONTORNO} strokeWidth="3" />;
        })}
        <g opacity=".62">
          <Faces faces={vidros} />
        </g>
        <path
          d={[5.95, 6.5, 7.05].map((u) => linha([u, 4.3, 0.25], [u, 4.3, 1.5], [u, 3.4, 2.5])).join('')}
          fill="none"
          stroke={cor('folha')}
          strokeWidth="3.5"
        />
      </>
    );
  },
  piscina: () => (
    <>
      <Faces faces={caixa({ u: [-7.55, -5.05], v: [-0.15, 2.35], z: [0, 0.22] }, PEDRA)} />
      <Faces faces={[retangulo(AGUA, [-7.3, -5.3], [0.1, 2.1], 0.22)]} />
      <Ondas u={-6.3} v={1.1} quantas={[[-22, -10], [20, 6], [-8, 20]]} />
      <ellipse {...circuloNoChao([-5.9, 0.9, 0.3], 0.3)} fill="none" stroke={cor('cancelar')} strokeWidth="9" />
      <path d={ESCADA_DA_PISCINA} fill="none" stroke={CONTORNO} strokeWidth="4" strokeLinejoin="round" />
    </>
  ),
  lago: () => (
    <>
      <ellipse {...circuloNoChao([-6, 5.4, 0], 1.75)} fill={PEDRA.topo} stroke={CONTORNO} strokeWidth="4" />
      <ellipse {...circuloNoChao([-6, 5.4, 0], 1.5)} fill={AGUA} stroke={CONTORNO} strokeWidth="3" />
      <Ondas u={-6} v={5.4} quantas={[[-36, -12], [16, -22], [28, 12], [-14, 20]]} />
      {VITORIAS_REGIAS.map(([u, v]) => (
        <ellipse key={u} {...circuloNoChao([u, v, 0.04], 0.22)} fill={FOLHAGEM} stroke={CONTORNO} strokeWidth="2.5" />
      ))}
      {/* O deque que avança sobre a água. */}
      <Faces faces={caixa({ u: [-5.4, -3.9], v: [4.75, 5.55], z: [0, 0.2] }, MADEIRA)} traco={3} />
      <path d={[-5.1, -4.8, -4.5, -4.2].map((u) => linha([u, 4.75, 0.2], [u, 5.55, 0.2])).join('')} stroke={CONTORNO} strokeWidth="2" opacity=".5" />
    </>
  ),
  ponte: () => <Ponte />,
  poste: () =>
    EM_PE(
      NO_CHAO(-2.8, 5.2),
      <>
        <ellipse rx="16" ry="6" fill={CONTORNO} opacity=".18" />
        <circle className="halo" cy="-92" r="30" fill={cor('sol')} opacity="0" />
        <path d="M-4 0v-78h8V0z" fill={cor('descanso-borda')} {...TRACO} />
        <rect className="janela-vidro" x="-13" y="-104" width="26" height="28" rx="6" fill={cor('creme')} {...TRACO} />
        <path d="M-17-104h34L0-118z" fill={cor('descanso')} {...TRACO} />
      </>,
    ),
  'caixa-correio': () =>
    EM_PE(
      NO_CHAO(-0.5, 5.5),
      <>
        <ellipse rx="16" ry="6" fill={CONTORNO} opacity=".18" />
        <path d="M-4 0v-34h8V0z" fill={cor('madeira')} {...TRACO} />
        <path d="M-20-32v-18a12 12 0 0 1 12-12h16a12 12 0 0 1 12 12v18z" fill={cor('etiqueta-azul')} {...TRACO} />
        <path d="M-12-50h20" stroke={CONTORNO} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M20-44v-28h14v10H20" fill={cor('cancelar')} stroke={CONTORNO} strokeWidth="3" strokeLinejoin="round" />
      </>,
    ),
  cerca: () => (
    <Faces
      faces={[
        ...POSTES_DA_CERCA.flatMap((u) => caixa({ u: [u, u + 0.12], v: [4.4, 4.52], z: [0, 0.8] }, PAREDE)),
        // A travessa passa na frente dos postes (com um vão no caminho).
        ...TRAVESSAS.map(([de, ate]) =>
          face(PAREDE.topo, [
            [de, 4.52, 0.55],
            [ate, 4.52, 0.55],
            [ate, 4.52, 0.7],
            [de, 4.52, 0.7],
          ]),
        ),
      ]}
    />
  ),
} as const satisfies Partial<Record<ParteId, Arte>>;
