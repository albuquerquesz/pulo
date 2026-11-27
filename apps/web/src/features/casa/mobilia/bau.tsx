import { escuro, P } from './geometria';
import { TRACEJADO } from './fantasma';
import { MADEIRA, OURO, ROSA } from './paleta';
import { Caixa, Elipse, Linha, Poligono } from './pecas';
import type { DesenhoProps, Movel } from './tipos';

function Fechado({ cor }: DesenhoProps) {
  return (
    <>
      <Caixa a={0.61} b={0.42} da={0.26} db={0.09} h0={0} h1={30} cor={cor} />
      <Caixa a={0.605} b={0.415} da={0.27} db={0.1} h0={30} h1={40} cor={escuro(cor, 0.1)} />
      <Linha de={P(0.67, 0.515, 0)} ate={P(0.67, 0.515, 40)} largura={5} cor={OURO} />
      <Linha de={P(0.81, 0.515, 0)} ate={P(0.81, 0.515, 40)} largura={5} cor={OURO} />
      <Poligono p={[P(0.725, 0.516, 22), P(0.755, 0.516, 22), P(0.755, 0.516, 34), P(0.725, 0.516, 34)]} fill={OURO} />
    </>
  );
}

function Caixote({ cor }: DesenhoProps) {
  return (
    <>
      <Caixa a={0.63} b={0.42} da={0.22} db={0.09} h0={0} h1={34} cor={cor} />
      <Linha de={P(0.63, 0.51, 12)} ate={P(0.85, 0.51, 12)} largura={2.5} />
      <Linha de={P(0.63, 0.51, 23)} ate={P(0.85, 0.51, 23)} largura={2.5} />
      <Elipse em={P(0.74, 0.465, 44)} rx={15} ry={11} fill={ROSA} />
    </>
  );
}

export const BAU: Movel = {
  id: 'bau',
  nome: 'Baú',
  onde: 'no pé da cama',
  tipo: 'chao',
  camada: 6,
  Fantasma: () => <Poligono p={[P(0.87, 0.42), P(0.87, 0.51), P(0.61, 0.51), P(0.61, 0.42)]} {...TRACEJADO} />,
  modelos: [
    { id: 'bau-bau', nome: 'Baú', natural: '#e9785b', Desenho: Fechado },
    { id: 'bau-caixote', nome: 'Caixote', natural: MADEIRA, Desenho: Caixote },
  ],
};
