import { claro, escuro, P } from './geometria';
import { TRACEJADO } from './fantasma';
import { BRANCO, MADEIRA, MADEIRA_ESC } from './paleta';
import { Caixa, Poligono } from './pecas';
import type { DesenhoProps, Movel } from './tipos';

const BOTOES_DA_CABECEIRA = [[0.62, 96], [0.74, 96], [0.86, 96], [0.68, 72], [0.8, 72]] as const satisfies readonly (readonly [number, number])[];

function Simples({ cor }: DesenhoProps) {
  return (
    <>
      <Caixa a={0.56} b={0} da={0.36} db={0.035} h0={0} h1={82} cor={MADEIRA} />
      <Caixa a={0.56} b={0.035} da={0.36} db={0.365} h0={0} h1={24} cor={MADEIRA} />
      <Caixa a={0.57} b={0.035} da={0.34} db={0.35} h0={24} h1={40} cor={BRANCO} />
      <Caixa a={0.61} b={0.05} da={0.26} db={0.08} h0={40} h1={52} cor={BRANCO} />
      <Caixa a={0.56} b={0.16} da={0.36} db={0.24} h0={26} h1={45} cor={cor} />
      <Caixa a={0.56} b={0.16} da={0.36} db={0.035} h0={45} h1={47} cor={claro(cor, 0.4)} />
    </>
  );
}

function Estofada({ cor }: DesenhoProps) {
  return (
    <>
      <Caixa a={0.55} b={0} da={0.38} db={0.045} h0={0} h1={122} cor={cor} />
      {BOTOES_DA_CABECEIRA.map(([a, h]) => {
        const [x, y] = P(a, 0.046, h);
        return <circle key={`${a} ${h}`} cx={x} cy={y} r="3" fill={escuro(cor, 0.3)} />;
      })}
      <Caixa a={0.56} b={0.045} da={0.36} db={0.355} h0={0} h1={22} cor={MADEIRA_ESC} />
      <Caixa a={0.57} b={0.045} da={0.34} db={0.34} h0={22} h1={40} cor={BRANCO} />
      <Caixa a={0.59} b={0.06} da={0.14} db={0.08} h0={40} h1={52} cor={BRANCO} />
      <Caixa a={0.75} b={0.06} da={0.14} db={0.08} h0={40} h1={52} cor={BRANCO} />
      <Caixa a={0.56} b={0.17} da={0.36} db={0.23} h0={24} h1={44} cor={claro(cor, 0.45)} />
    </>
  );
}

function Futon({ cor }: DesenhoProps) {
  return (
    <>
      <Caixa a={0.56} b={0.02} da={0.36} db={0.38} h0={0} h1={10} cor={MADEIRA_ESC} />
      <Caixa a={0.57} b={0.03} da={0.34} db={0.36} h0={10} h1={30} cor={cor} />
      <Caixa a={0.6} b={0.045} da={0.13} db={0.08} h0={30} h1={40} cor={BRANCO} />
      <Caixa a={0.76} b={0.045} da={0.13} db={0.08} h0={30} h1={40} cor={BRANCO} />
      <Caixa a={0.57} b={0.28} da={0.34} db={0.08} h0={30} h1={37} cor={claro(cor, 0.45)} />
    </>
  );
}

export const CAMA: Movel = {
  id: 'cama',
  nome: 'Cama',
  onde: 'encostada na parede da esquerda',
  tipo: 'chao',
  camada: 4,
  Fantasma: () => <Poligono p={[P(0.92, 0), P(0.92, 0.4), P(0.56, 0.4), P(0.56, 0)]} {...TRACEJADO} />,
  modelos: [
    { id: 'cama-simples', nome: 'Simples', natural: '#7fb7f0', Desenho: Simples },
    { id: 'cama-estofada', nome: 'Estofada', natural: '#b583ff', Desenho: Estofada },
    { id: 'cama-futon', nome: 'Futon', natural: '#9dd96c', Desenho: Futon },
  ],
};
