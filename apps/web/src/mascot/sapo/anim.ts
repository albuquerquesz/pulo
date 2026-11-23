/**
 * Animações de um disparo (pulo, squash, pouso, desvanecimento) com a Web Animations API.
 * Uma trilha é uma lista de pontos no tempo; cada ponto leva a curva do trecho que começa nele.
 * Funções puras, exceto `tocar`, que só roda em efeitos (nunca no servidor).
 */

/** Curvas equivalentes às do Reanimated. */
export const CURVA = {
  linear: 'linear',
  saidaQuad: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  entradaQuad: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
} as const;

export interface Ponto {
  /** Tempo em ms desde o início da trilha. */
  t: number;
  valor: number;
  /** Curva do trecho que começa neste ponto. */
  curva: string;
}

export type Trilha = readonly Ponto[];

export interface Mola {
  damping: number;
  stiffness: number;
}

const fim = (trilha: Trilha): Ponto => trilha[trilha.length - 1];

/** Começa uma trilha parada em `valor`. */
export function trilha(valor: number): Trilha {
  return [{ t: 0, valor, curva: CURVA.linear }];
}

/** Fica parado por `ms` (como withDelay). */
export function esperar(base: Trilha, ms: number): Trilha {
  if (ms <= 0) return base;
  const ultimo = fim(base);
  return [...base, { t: ultimo.t + ms, valor: ultimo.valor, curva: CURVA.linear }];
}

/** Vai até `valor` em `ms` com a curva dada (como withTiming). */
export function ir(base: Trilha, valor: number, ms: number, curva: string = CURVA.linear): Trilha {
  const anteriores = base.slice(0, -1);
  const ultimo = fim(base);
  return [...anteriores, { ...ultimo, curva }, { t: ultimo.t + ms, valor, curva: CURVA.linear }];
}

const PASSO_DA_MOLA_MS = 16;
const MOLA_MAX_MS = 1500;

/**
 * Curva normalizada de uma mola (massa 1) indo de 0 a 1, amostrada a cada 16 ms até assentar.
 * Equivale ao withSpring do Reanimated com o mesmo damping e stiffness.
 */
export function curvaDaMola({ damping, stiffness }: Mola): number[] {
  const dt = 1 / 1000;
  const amostras = [0];
  let x = 0;
  let v = 0;
  for (let ms = 1; ms <= MOLA_MAX_MS; ms++) {
    v += (-stiffness * (x - 1) - damping * v) * dt;
    x += v * dt;
    if (ms % PASSO_DA_MOLA_MS !== 0) continue;
    amostras.push(x);
    if (Math.abs(x - 1) < 0.002 && Math.abs(v) < 0.02) break;
  }
  amostras[amostras.length - 1] = 1;
  return amostras;
}

/** Vai até `valor` com mola (como withSpring). */
export function molaAte(base: Trilha, valor: number, mola: Mola): Trilha {
  const ultimo = fim(base);
  const de = ultimo.valor;
  const pontos = curvaDaMola(mola)
    .slice(1)
    .map((s, i) => ({ t: ultimo.t + (i + 1) * PASSO_DA_MOLA_MS, valor: de + (valor - de) * s, curva: CURVA.linear }));
  return [...base, ...pontos];
}

export type Formato = (valor: number) => Keyframe;

export interface Quadros {
  quadros: Keyframe[];
  duracao: number;
}

/** Converte a trilha em quadros da Web Animations API. */
export function paraQuadros(base: Trilha, formato: Formato): Quadros {
  const duracao = fim(base).t;
  const quadros = base.map((p) => ({
    ...formato(p.valor),
    offset: duracao > 0 ? p.t / duracao : 0,
    easing: p.curva,
  }));
  return { quadros, duracao };
}

/**
 * Toca a trilha no elemento, cancelando a animação anterior do mesmo canal.
 * Sem `element.animate` (jsdom, navegadores antigos), não faz nada: o elemento fica no estado de repouso.
 */
export function tocar(el: Element | null, anterior: Animation | null, { quadros, duracao }: Quadros, manter = false): Animation | null {
  anterior?.cancel();
  if (!el || typeof el.animate !== 'function' || duracao <= 0) return null;
  return el.animate(quadros, { duration: duracao, fill: manter ? 'forwards' : 'none' });
}
