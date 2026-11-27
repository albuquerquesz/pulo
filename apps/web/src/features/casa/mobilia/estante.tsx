import { claro, escuro, P } from './geometria';
import { TRACEJADO } from './fantasma';
import { AGUA, FOLHA, MADEIRA, OURO, ROSA } from './paleta';
import { Caixa, Cilindro, Elipse, Poligono } from './pecas';
import type { DesenhoProps, Movel } from './tipos';

const CORES_DOS_LIVROS = [ROSA, AGUA, OURO, '#b583ff', '#9dd96c', '#ff7a59'];
const PRATELEIRAS = [8, 60, 112];

interface Livro {
  a: number;
  largura: number;
  altura: number;
  cor: string;
}

/** Os livros de uma prateleira, enquanto couberem. */
function livrosDa(k: number): Livro[] {
  const livros: Livro[] = [];
  let a = 0.085;
  for (let i = 0; i < 7; i += 1) {
    const largura = 0.022 + ((i * 7 + k * 3) % 3) * 0.006;
    if (a + largura > 0.315) break;
    livros.push({ a, largura, altura: 30 + ((i * 5 + k) % 4) * 4, cor: CORES_DOS_LIVROS[(i + k * 2) % CORES_DOS_LIVROS.length] });
    a += largura + 0.004;
  }
  return livros;
}

function Livros({ cor }: DesenhoProps) {
  return (
    <>
      <Caixa a={0.06} b={0} da={0.28} db={0.11} h0={0} h1={165} cor={cor} />
      {PRATELEIRAS.map((h0, k) => (
        <g key={h0}>
          <Poligono p={[P(0.08, 0.11, h0), P(0.32, 0.11, h0), P(0.32, 0.11, h0 + 46), P(0.08, 0.11, h0 + 46)]} fill={escuro(cor, 0.35)} />
          {livrosDa(k).map(({ a, largura, altura, cor: capa }) => (
            <Poligono key={a} p={[P(a, 0.112, h0), P(a + largura, 0.112, h0), P(a + largura, 0.112, h0 + altura), P(a, 0.112, h0 + altura)]} fill={capa} />
          ))}
        </g>
      ))}
    </>
  );
}

function Comoda({ cor }: DesenhoProps) {
  return (
    <>
      <Caixa a={0.06} b={0} da={0.28} db={0.12} h0={0} h1={86} cor={cor} />
      {[8, 34, 60].map((h0) => (
        <g key={h0}>
          <Poligono p={[P(0.08, 0.12, h0), P(0.32, 0.12, h0), P(0.32, 0.12, h0 + 20), P(0.08, 0.12, h0 + 20)]} fill={claro(cor, 0.15)} />
          <Elipse em={P(0.2, 0.12, h0 + 10)} rx={3.5} ry={3.5} fill={OURO} strokeWidth="2" />
        </g>
      ))}
      <Cilindro a={0.2} b={0.06} r={0.035} h0={86} h1={112} cor="#e9785b" />
      <Elipse em={P(0.2, 0.06, 126)} rx={22} ry={16} fill={FOLHA} />
    </>
  );
}

export const ESTANTE: Movel = {
  id: 'estante',
  nome: 'Estante',
  onde: 'parede da esquerda, no fundo',
  tipo: 'chao',
  camada: 2,
  Fantasma: () => <Poligono p={[P(0.34, 0), P(0.34, 0.11), P(0.06, 0.11), P(0.06, 0)]} {...TRACEJADO} />,
  modelos: [
    { id: 'estante-livros', nome: 'Livros', natural: MADEIRA, Desenho: Livros },
    { id: 'estante-comoda', nome: 'Cômoda', natural: AGUA, Desenho: Comoda },
  ],
};
