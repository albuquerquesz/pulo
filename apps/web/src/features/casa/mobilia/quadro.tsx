import { circuloParede, E, retParede } from './geometria';
import { TRACEJADO } from './fantasma';
import { AGUA, BRANCO, CONTORNO, MADEIRA, OURO, ROSA, VIDRO } from './paleta';
import { Poligono } from './pecas';
import type { DesenhoProps, Movel } from './tipos';

function Paisagem({ cor }: DesenhoProps) {
  return (
    <>
      <Poligono p={retParede('e', 0.63, 0.85, 148, 220, 0.012)} fill={cor} />
      <Poligono p={retParede('e', 0.655, 0.825, 158, 210, 0.014)} fill={VIDRO} />
      <Poligono p={[E(0.655, 158, 0.016), E(0.71, 188, 0.016), E(0.75, 173, 0.016), E(0.8, 196, 0.016), E(0.825, 178, 0.016), E(0.825, 158, 0.016)]} fill="#8fd45f" />
      <Poligono p={circuloParede('e', 0.695, 198, 7, 0.016)} fill="#ffd25c" />
    </>
  );
}

function Retrato({ cor }: DesenhoProps) {
  return (
    <>
      <Poligono p={circuloParede('e', 0.74, 184, 40, 0.012, 36)} fill={cor} />
      <Poligono p={circuloParede('e', 0.74, 184, 30, 0.014, 36)} fill="#fff3da" />
      <Poligono p={circuloParede('e', 0.725, 190, 8, 0.016)} fill="#8fe05a" />
      <Poligono p={circuloParede('e', 0.755, 190, 8, 0.016)} fill="#8fe05a" />
      <Poligono p={circuloParede('e', 0.74, 174, 17, 0.016)} fill="#8fe05a" />
    </>
  );
}

function Abstrato({ cor }: DesenhoProps) {
  return (
    <>
      <Poligono p={retParede('e', 0.61, 0.87, 146, 224, 0.012)} fill={cor} />
      <Poligono p={retParede('e', 0.63, 0.85, 154, 216, 0.014)} fill={BRANCO} />
      <Poligono p={retParede('e', 0.64, 0.73, 160, 200, 0.016)} fill={ROSA} />
      <Poligono p={retParede('e', 0.71, 0.84, 178, 210, 0.016)} fill={AGUA} />
      <Poligono p={circuloParede('e', 0.77, 168, 9, 0.017)} fill={OURO} />
    </>
  );
}

export const QUADRO: Movel = {
  id: 'quadro',
  nome: 'Quadro',
  onde: 'parede da esquerda, em cima da cama',
  tipo: 'parede',
  camada: 1,
  Fantasma: () => <Poligono p={retParede('e', 0.63, 0.85, 148, 220)} {...TRACEJADO} />,
  modelos: [
    { id: 'quadro-paisagem', nome: 'Paisagem', natural: MADEIRA, Desenho: Paisagem },
    { id: 'quadro-retrato', nome: 'Retrato', natural: '#e7b0c9', Desenho: Retrato },
    { id: 'quadro-abstrato', nome: 'Abstrato', natural: CONTORNO, Desenho: Abstrato },
  ],
};
