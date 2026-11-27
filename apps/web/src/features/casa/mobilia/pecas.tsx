import type { SVGProps } from 'react';

import { claro, emCaminho, emPontos, escuro, P, raiosNoChao, type Ponto, type Pontos } from './geometria';
import { CONTORNO } from './paleta';

const TRACO = { stroke: CONTORNO, strokeWidth: 3, strokeLinejoin: 'round' } as const;

type PoligonoProps = SVGProps<SVGPolygonElement> & { p: Pontos };

export function Poligono({ p, ...resto }: PoligonoProps) {
  return <polygon points={emPontos(p)} {...TRACO} {...resto} />;
}

type LinhaProps = Omit<SVGProps<SVGPathElement>, 'to' | 'from'> & { de: Ponto; ate: Ponto; largura?: number; cor?: string };

export function Linha({ de, ate, largura = 3, cor = CONTORNO, ...resto }: LinhaProps) {
  return <path d={emCaminho(de, ate)} stroke={cor} strokeWidth={largura} strokeLinecap="round" fill="none" {...resto} />;
}

type ElipseProps = SVGProps<SVGEllipseElement> & { em: Ponto; rx: number; ry: number };

/** Uma elipse contornada, centrada num ponto do quarto. */
export function Elipse({ em: [x, y], ...resto }: ElipseProps) {
  return <ellipse cx={x} cy={y} {...TRACO} {...resto} />;
}

type CaixaProps = {
  a: number;
  b: number;
  da: number;
  db: number;
  h0: number;
  h1: number;
  cor: string;
};

/** Uma caixa no chão: as três faces que se veem (topo, a da esquerda e a da direita). */
export function Caixa({ a, b, da, db, h0, h1, cor }: CaixaProps) {
  const a1 = a + da;
  const b1 = b + db;
  return (
    <>
      <Poligono p={[P(a1, b, h0), P(a1, b1, h0), P(a1, b1, h1), P(a1, b, h1)]} fill={cor} />
      <Poligono p={[P(a, b1, h0), P(a1, b1, h0), P(a1, b1, h1), P(a, b1, h1)]} fill={escuro(cor)} />
      <Poligono p={[P(a, b, h1), P(a1, b, h1), P(a1, b1, h1), P(a, b1, h1)]} fill={claro(cor)} />
    </>
  );
}

type TroncoProps = {
  a: number;
  b: number;
  /** Raio embaixo. */
  r0: number;
  /** Raio em cima. */
  r1: number;
  h0: number;
  h1: number;
  cor: string;
  topo: string;
};

function Tronco({ a, b, r0, r1, h0, h1, cor, topo }: TroncoProps) {
  const [cx, baixo] = P(a, b, h0);
  const [, alto] = P(a, b, h1);
  const de = raiosNoChao(r0);
  const ate = raiosNoChao(r1);
  return (
    <>
      <path d={`M${cx - ate.rx} ${alto}L${cx - de.rx} ${baixo}A${de.rx} ${de.ry} 0 0 0 ${cx + de.rx} ${baixo}L${cx + ate.rx} ${alto}Z`} fill={cor} {...TRACO} />
      <ellipse cx={cx} cy={alto} rx={ate.rx} ry={ate.ry} fill={topo} {...TRACO} />
    </>
  );
}

type CilindroProps = Omit<TroncoProps, 'r0' | 'r1' | 'topo'> & { r: number };

/** Um cilindro de pé (vaso, pufe). */
export function Cilindro({ r, cor, ...resto }: CilindroProps) {
  return <Tronco {...resto} r0={r} r1={r} cor={cor} topo={claro(cor)} />;
}

/** Um tronco de cone aberto em cima (cúpula de luminária). */
export function Cone({ cor, ...resto }: Omit<TroncoProps, 'topo'>) {
  return <Tronco {...resto} cor={cor} topo={escuro(cor, 0.35)} />;
}
