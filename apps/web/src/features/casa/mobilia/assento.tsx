import { claro, P } from './geometria';
import { TRACEJADO } from './fantasma';
import { OURO } from './paleta';
import { Caixa, Cilindro, Poligono } from './pecas';
import type { DesenhoProps, Movel } from './tipos';

function Poltrona({ cor }: DesenhoProps) {
  return (
    <>
      <Caixa a={0} b={0.56} da={0.05} db={0.24} h0={0} h1={76} cor={cor} />
      <Caixa a={0.05} b={0.53} da={0.22} db={0.04} h0={0} h1={46} cor={cor} />
      <Caixa a={0.05} b={0.57} da={0.2} db={0.2} h0={0} h1={30} cor={cor} />
      <Caixa a={0.06} b={0.58} da={0.18} db={0.18} h0={30} h1={38} cor={claro(cor, 0.3)} />
      <Caixa a={0.05} b={0.77} da={0.22} db={0.04} h0={0} h1={46} cor={cor} />
    </>
  );
}

function Sofa({ cor }: DesenhoProps) {
  return (
    <>
      <Caixa a={0} b={0.49} da={0.05} db={0.36} h0={0} h1={72} cor={cor} />
      <Caixa a={0.05} b={0.46} da={0.22} db={0.04} h0={0} h1={44} cor={cor} />
      <Caixa a={0.05} b={0.5} da={0.2} db={0.34} h0={0} h1={28} cor={cor} />
      <Caixa a={0.06} b={0.51} da={0.18} db={0.16} h0={28} h1={37} cor={claro(cor, 0.3)} />
      <Caixa a={0.06} b={0.67} da={0.18} db={0.16} h0={28} h1={37} cor={claro(cor, 0.3)} />
      <Caixa a={0.05} b={0.84} da={0.22} db={0.04} h0={0} h1={44} cor={cor} />
      <Caixa a={0.06} b={0.53} da={0.04} db={0.1} h0={37} h1={62} cor={OURO} />
    </>
  );
}

function Pufe({ cor }: DesenhoProps) {
  const [x, y] = P(0.14, 0.66, 34);
  return (
    <>
      <Cilindro a={0.14} b={0.66} r={0.085} h0={0} h1={34} cor={cor} />
      <ellipse cx={x} cy={y} rx="18" ry="9" fill={claro(cor, 0.45)} />
    </>
  );
}

export const ASSENTO: Movel = {
  id: 'assento',
  nome: 'Sofá',
  onde: 'encostado na parede da direita',
  tipo: 'chao',
  camada: 5,
  Fantasma: () => <Poligono p={[P(0, 0.46), P(0.27, 0.46), P(0.27, 0.88), P(0, 0.88)]} {...TRACEJADO} />,
  modelos: [
    { id: 'assento-poltrona', nome: 'Poltrona', natural: '#ff7a59', Desenho: Poltrona },
    { id: 'assento-sofa', nome: 'Sofá', natural: '#7fb7f0', Desenho: Sofa },
    { id: 'assento-pufe', nome: 'Pufe', natural: '#b583ff', Desenho: Pufe },
  ],
};
