/*
 * A projeção isométrica do quarto (a mesma do `Comodo`), como no rascunho (public/rascunhos/mobilia.html).
 * Chão: canto de trás (400,340), esquerda (100,490), direita (700,490), frente (400,640).
 * `a` vai para a parede da esquerda e a frente, `b` para a direita e a frente (0 a 1); `h` é a altura.
 */
export type Ponto = readonly [number, number];
export type Pontos = readonly Ponto[];
/** Parede da esquerda (b = 0) ou da direita (a = 0). */
export type LadoDaParede = 'e' | 'd';

export const P = (a: number, b: number, h = 0): Ponto => [400 - 300 * a + 300 * b, 340 + 150 * a + 150 * b - h];

const casa = (n: number) => n.toFixed(1);
export const emPontos = (lista: Pontos): string => lista.map(([x, y]) => `${casa(x)},${casa(y)}`).join(' ');
export const emCaminho = ([x1, y1]: Ponto, [x2, y2]: Ponto): string => `M${casa(x1)} ${casa(y1)}L${casa(x2)} ${casa(y2)}`;

function mix(hex: string, alvo: string, f: number): string {
  const canais = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const destino = canais(alvo);
  const misturados = canais(hex).map((c, i) => Math.round(c + (destino[i] - c) * f).toString(16).padStart(2, '0'));
  return `#${misturados.join('')}`;
}
export const claro = (cor: string, f = 0.22): string => mix(cor, '#ffffff', f);
export const escuro = (cor: string, f = 0.18): string => mix(cor, '#1c1418', f);

/** Os raios de um círculo de raio `r` (em unidades do chão) deitado no chão. */
export const raiosNoChao = (r: number) => ({ rx: 424 * r, ry: 212 * r });

const FUNDO_DA_PAREDE = 0.006;

export const naParede = (lado: LadoDaParede, u: number, h: number, d = FUNDO_DA_PAREDE): Ponto => (lado === 'e' ? P(u, d, h) : P(d, u, h));
/** Parede da esquerda. */
export const E = (a: number, h: number, d?: number): Ponto => naParede('e', a, h, d);
/** Parede da direita. */
export const D = (b: number, h: number, d?: number): Ponto => naParede('d', b, h, d);

export const retParede = (lado: LadoDaParede, u0: number, u1: number, h0: number, h1: number, d?: number): Pontos => [
  naParede(lado, u0, h0, d),
  naParede(lado, u1, h0, d),
  naParede(lado, u1, h1, d),
  naParede(lado, u0, h1, d),
];

export function circuloParede(lado: LadoDaParede, u: number, h: number, raio: number, d = 0.008, n = 28): Pontos {
  const ru = raio / 335;
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return naParede(lado, u + ru * Math.cos(t), h + raio * Math.sin(t), d);
  });
}
