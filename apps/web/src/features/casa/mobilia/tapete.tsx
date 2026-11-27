import { claro, escuro, P } from './geometria';
import { TRACEJADO } from './fantasma';
import { AGUA, BRANCO, ROSA } from './paleta';
import { Elipse, Poligono } from './pecas';
import type { DesenhoProps, Movel } from './tipos';

const RISCADO = { fill: 'none', stroke: '#fff', strokeDasharray: '8 7', opacity: 0.85 } as const;
const LISTRAS = [0, 1, 2, 3, 4, 5];

function Redondo({ cor }: DesenhoProps) {
  const [x, y] = P(0.66, 0.66);
  return (
    <>
      <Elipse em={[x, y + 4]} rx={96} ry={48} fill={escuro(cor)} />
      <Elipse em={[x, y]} rx={96} ry={48} fill={cor} />
      <Elipse em={[x, y]} rx={68} ry={33} {...RISCADO} />
    </>
  );
}

function Retangular({ cor }: DesenhoProps) {
  return (
    <>
      <Poligono p={[P(0.48, 0.5), P(0.84, 0.5), P(0.84, 0.84), P(0.48, 0.84)]} fill={cor} />
      <Poligono p={[P(0.52, 0.54), P(0.8, 0.54), P(0.8, 0.8), P(0.52, 0.8)]} {...RISCADO} />
      <Poligono p={[P(0.6, 0.62), P(0.72, 0.62), P(0.72, 0.72), P(0.6, 0.72)]} fill={claro(cor, 0.35)} />
    </>
  );
}

function Listrado({ cor }: DesenhoProps) {
  return (
    <>
      {LISTRAS.map((i) => {
        const b0 = 0.5 + i * 0.057;
        return <Poligono key={i} p={[P(0.48, b0), P(0.84, b0), P(0.84, b0 + 0.057), P(0.48, b0 + 0.057)]} fill={i % 2 ? BRANCO : cor} />;
      })}
    </>
  );
}

export const TAPETE: Movel = {
  id: 'tapete',
  nome: 'Tapete',
  onde: 'no meio do quarto, embaixo do sapo',
  tipo: 'tapete',
  camada: 0,
  Fantasma: () => <Elipse em={P(0.66, 0.66)} rx={96} ry={48} {...TRACEJADO} />,
  modelos: [
    { id: 'tapete-redondo', nome: 'Redondo', natural: '#c9a96a', Desenho: Redondo },
    { id: 'tapete-retangular', nome: 'Retangular', natural: ROSA, Desenho: Retangular },
    { id: 'tapete-listrado', nome: 'Listrado', natural: AGUA, Desenho: Listrado },
  ],
};
