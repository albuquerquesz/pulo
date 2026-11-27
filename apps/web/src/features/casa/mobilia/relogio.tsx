import { circuloParede, D, escuro } from './geometria';
import { TRACEJADO } from './fantasma';
import { MADEIRA, OURO, ROSA } from './paleta';
import { Linha, Poligono } from './pecas';
import type { DesenhoProps, Movel } from './tipos';

const MOSTRADOR = '#fffaf0';

function Redondo({ cor }: DesenhoProps) {
  return (
    <>
      <Poligono p={circuloParede('d', 0.24, 226, 26, 0.012)} fill={cor} />
      <Poligono p={circuloParede('d', 0.24, 226, 19, 0.014)} fill={MOSTRADOR} />
      <Linha de={D(0.24, 226, 0.016)} ate={D(0.24, 240, 0.016)} largura={3.5} />
      <Linha de={D(0.24, 226, 0.016)} ate={D(0.265, 226, 0.016)} largura={3.5} />
    </>
  );
}

function Cuco({ cor }: DesenhoProps) {
  return (
    <>
      <Poligono p={[D(0.19, 190, 0.012), D(0.29, 190, 0.012), D(0.29, 236, 0.012), D(0.24, 262, 0.012), D(0.19, 236, 0.012)]} fill={cor} />
      <Poligono
        p={[D(0.18, 234, 0.014), D(0.24, 266, 0.014), D(0.3, 234, 0.014), D(0.3, 240, 0.014), D(0.24, 272, 0.014), D(0.18, 240, 0.014)]}
        fill={escuro(cor, 0.3)}
      />
      <Poligono p={circuloParede('d', 0.24, 214, 13, 0.016)} fill={MOSTRADOR} />
      <Linha de={D(0.24, 214, 0.018)} ate={D(0.24, 222, 0.018)} />
      <Linha de={D(0.24, 214, 0.018)} ate={D(0.253, 214, 0.018)} />
      <Linha de={D(0.225, 190, 0.012)} ate={D(0.225, 158, 0.012)} largura={2} />
      <Poligono p={circuloParede('d', 0.225, 154, 6, 0.012)} fill={OURO} />
    </>
  );
}

export const RELOGIO: Movel = {
  id: 'relogio',
  nome: 'Relógio',
  onde: 'parede da direita, em cima da luminária',
  tipo: 'parede',
  camada: 1,
  Fantasma: () => <Poligono p={circuloParede('d', 0.24, 226, 26, 0.006)} {...TRACEJADO} strokeDasharray="6 5" />,
  modelos: [
    { id: 'relogio-redondo', nome: 'Redondo', natural: ROSA, Desenho: Redondo },
    { id: 'relogio-cuco', nome: 'Cuco', natural: MADEIRA, Desenho: Cuco },
  ],
};
