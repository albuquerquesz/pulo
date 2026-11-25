/**
 * Gerador isométrico da ilha, como o do rascunho. Coordenadas do mundo: `u` desce para a direita, `v` desce para a
 * esquerda e `z` sobe; uma unidade vale 46 unidades do desenho. Tudo puro.
 */
export type Ponto3d = readonly [u: number, v: number, z: number];

export interface Face {
  pontos: string;
  cor: string;
}

/** De um canto ao outro em cada eixo. */
export type Intervalo = readonly [de: number, ate: number];

export interface Volume {
  u: Intervalo;
  v: Intervalo;
  z: Intervalo;
}

const UNIDADE = 46;
const CENTRO = { x: 500, y: 480 };
const COSSENO_30 = Math.cos(Math.PI / 6);
/** Quanto o telhado passa das paredes. */
const BEIRAL = 0.25;

/** Onde um ponto do mundo cai no desenho, com uma casa decimal. */
export function projetar([u, v, z]: Ponto3d): { x: number; y: number } {
  const arredondar = (n: number) => Math.round(n * 10) / 10;
  return {
    x: arredondar(CENTRO.x + (u - v) * COSSENO_30 * UNIDADE),
    y: arredondar(CENTRO.y + ((u + v) / 2 - z) * UNIDADE),
  };
}

export function face(cor: string, pontos: readonly Ponto3d[]): Face {
  const texto = pontos.map((p) => {
    const { x, y } = projetar(p);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return { cor, pontos: texto.join(' ') };
}

/** Retângulo numa parede virada para a esquerda (`v` fixo): portas, janelas e paredes. */
export const naParedeEsquerda = (cor: string, v: number, [u0, u1]: Intervalo, [z0, z1]: Intervalo): Face =>
  face(cor, [
    [u0, v, z0],
    [u1, v, z0],
    [u1, v, z1],
    [u0, v, z1],
  ]);

/** Retângulo numa parede virada para a direita (`u` fixo). */
export const naParedeDireita = (cor: string, u: number, [v0, v1]: Intervalo, [z0, z1]: Intervalo): Face =>
  face(cor, [
    [u, v0, z0],
    [u, v1, z0],
    [u, v1, z1],
    [u, v0, z1],
  ]);

export interface CoresDaCaixa {
  esquerda: string;
  direita: string;
  /** Sem topo quando um telhado cobre a caixa. */
  topo?: string;
}

/** As faces visíveis de uma caixa: esquerda, direita e topo. */
export function caixa({ u, v, z }: Volume, cores: CoresDaCaixa): Face[] {
  const faces = [naParedeEsquerda(cores.esquerda, v[1], u, z), naParedeDireita(cores.direita, u[1], v, z)];
  if (!cores.topo) return faces;
  return [
    ...faces,
    face(cores.topo, [
      [u[0], v[0], z[1]],
      [u[1], v[0], z[1]],
      [u[1], v[1], z[1]],
      [u[0], v[1], z[1]],
    ]),
  ];
}

export interface CoresDoTelhado {
  fundo: string;
  empena: string;
  frente: string;
}

/** Telhado de duas águas com a cumeeira ao longo de `u`. `z` vai da beira das paredes à cumeeira. */
export function telhado({ u, v, z }: Volume, cores: CoresDoTelhado): Face[] {
  const [u0, u1] = [u[0] - BEIRAL, u[1] + BEIRAL];
  const [beira, cume] = z;
  const meio = (v[0] + v[1]) / 2;
  return [
    face(cores.fundo, [
      [u0, v[0] - BEIRAL, beira],
      [u1, v[0] - BEIRAL, beira],
      [u1, meio, cume],
      [u0, meio, cume],
    ]),
    face(cores.empena, [
      [u[1], v[0], beira],
      [u[1], v[1], beira],
      [u[1], meio, cume],
    ]),
    face(cores.frente, [
      [u0, meio, cume],
      [u1, meio, cume],
      [u1, v[1] + BEIRAL, beira],
      [u0, v[1] + BEIRAL, beira],
    ]),
  ];
}
