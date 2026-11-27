import { D, retParede, type Pontos } from './geometria';
import { TRACEJADO } from './fantasma';
import { ROSA, VIDRO } from './paleta';
import { Caixa, Linha, Poligono } from './pecas';
import type { DesenhoProps, Movel } from './tipos';

function Quadrada({ cor }: DesenhoProps) {
  return (
    <>
      <Poligono p={retParede('d', 0.5, 0.72, 110, 230, 0.012)} fill={cor} />
      <Poligono p={retParede('d', 0.52, 0.7, 120, 220, 0.014)} fill={VIDRO} />
      <Linha de={D(0.61, 120, 0.016)} ate={D(0.61, 220, 0.016)} />
      <Linha de={D(0.52, 170, 0.016)} ate={D(0.7, 170, 0.016)} />
      <Linha de={D(0.55, 205, 0.016)} ate={D(0.58, 190, 0.016)} cor="#ffffff" opacity=".8" />
      <Caixa a={0} b={0.49} da={0.035} db={0.24} h0={102} h1={110} cor={cor} />
    </>
  );
}

function arco(raio: number, d: number, base: number, altura: number): Pontos {
  const curva = Array.from({ length: 17 }, (_, i) => {
    const t = (i / 16) * Math.PI;
    return D(0.61 + raio * Math.cos(t), altura + raio * 335 * Math.sin(t) * 0.9, d);
  });
  return [D(0.61 - raio, base, d), D(0.61 + raio, base, d), ...curva];
}

function EmArco({ cor }: DesenhoProps) {
  return (
    <>
      <Poligono p={arco(0.12, 0.012, 108, 180)} fill={cor} />
      <Poligono p={arco(0.1, 0.014, 118, 180)} fill={VIDRO} />
      <Linha de={D(0.61, 118, 0.016)} ate={D(0.61, 210, 0.016)} />
      <Linha de={D(0.51, 175, 0.016)} ate={D(0.71, 175, 0.016)} />
      <Caixa a={0} b={0.48} da={0.035} db={0.26} h0={100} h1={108} cor={cor} />
    </>
  );
}

function Dupla({ cor }: DesenhoProps) {
  return (
    <>
      <Poligono p={retParede('d', 0.45, 0.77, 112, 222, 0.012)} fill={cor} />
      <Poligono p={retParede('d', 0.47, 0.6, 122, 212, 0.014)} fill={VIDRO} />
      <Poligono p={retParede('d', 0.62, 0.75, 122, 212, 0.014)} fill={VIDRO} />
      <Poligono p={retParede('d', 0.43, 0.46, 108, 226, 0.02)} fill={ROSA} />
      <Poligono p={retParede('d', 0.76, 0.79, 108, 226, 0.02)} fill={ROSA} />
      <Caixa a={0} b={0.44} da={0.035} db={0.34} h0={104} h1={112} cor={cor} />
    </>
  );
}

export const JANELA: Movel = {
  id: 'janela',
  nome: 'Janela',
  onde: 'parede da direita, em cima do sofá',
  tipo: 'parede',
  camada: 1,
  Fantasma: () => <Poligono p={retParede('d', 0.5, 0.72, 110, 230)} {...TRACEJADO} />,
  modelos: [
    { id: 'janela-quadrada', nome: 'Quadrada', natural: '#ffffff', Desenho: Quadrada },
    { id: 'janela-arco', nome: 'Arco', natural: '#ffffff', Desenho: EmArco },
    { id: 'janela-dupla', nome: 'Dupla', natural: '#ffffff', Desenho: Dupla },
  ],
};
