/*
 * A linguagem de animação da compra (public/rascunhos/mobilia.html), com Web Animations API.
 * Os efeitos na tela vão para o `body`; os do desenho vão para uma camada `<g>` vazia do SVG, que o React não toca.
 * Com reduzir movimento, quem chama não anima nada (`semMovimento`).
 */

export type TipoDeChegada = 'parede' | 'tapete' | 'chao';

export interface PontoNaTela {
  x: number;
  y: number;
}

/** Um retângulo nas unidades do desenho. */
export interface CaixaDoDesenho {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SVG = 'http://www.w3.org/2000/svg';
const CONTORNO = '#3b2a2f';
const CORES_DAS_ESTRELAS = ['#ffd25c', '#ff9db4', '#7fd8d8', '#b583ff'];

/** Reduzir movimento (do sistema ou do perfil), ou um navegador sem Web Animations. */
export const semMovimento = (): boolean =>
  typeof Element.prototype.animate !== 'function' ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
  document.documentElement.dataset.reduzirMovimento === 'true';

export const esperar = (ms: number): Promise<void> => new Promise((pronto) => setTimeout(pronto, ms));

export const centroNaTela = (el: Element): PontoNaTela => {
  const caixa = el.getBoundingClientRect();
  return { x: caixa.left + caixa.width / 2, y: caixa.top + caixa.height / 2 };
};

export const caixaDo = (el: SVGGraphicsElement): CaixaDoDesenho => el.getBBox();

/** Anima e espera acabar; uma animação cancelada também conta como acabada. */
export async function animar(el: Element, quadros: Keyframe[], opcoes: KeyframeAnimationOptions): Promise<void> {
  try {
    await el.animate(quadros, opcoes).finished;
  } catch {
    // Cancelada: o elemento saiu da tela.
  }
}

/** A escala e o giro do elemento passam a ser em volta de um ponto dele mesmo. */
export function apoiarEm(el: SVGElement, origem: string): void {
  el.style.transformBox = 'fill-box';
  el.style.transformOrigin = origem;
}

/** Um elemento passageiro: entra, anima e sai. */
function passageiro(pai: Element, el: Element, quadros: Keyframe[], opcoes: KeyframeAnimationOptions): Promise<void> {
  pai.appendChild(el);
  return animar(el, quadros, { fill: 'both', ...opcoes }).finally(() => el.remove());
}

export type Atributos = Record<string, string | number>;

export function efeito(camada: Element, tag: string, atributos: Atributos, quadros: Keyframe[], opcoes: KeyframeAnimationOptions, origem = 'center'): Promise<void> {
  const el = document.createElementNS(SVG, tag);
  for (const [nome, valor] of Object.entries(atributos)) el.setAttribute(nome, String(valor));
  apoiarEm(el, origem);
  return passageiro(camada, el, quadros, opcoes);
}

/** Mais joias para um preço maior. */
const quantasJoias = (preco: number) => Math.min(6, 2 + Math.round(preco / 15));

/** As joias saem do botão e voam em arco até o lugar da compra. */
export async function joiasVoando(origem: PontoNaTela, destino: PontoNaTela, preco: number): Promise<void> {
  const quantas = quantasJoias(preco);
  const voos = Array.from({ length: quantas }, (_, i) => {
    const joia = document.createElement('i');
    joia.className = 'joia-voando';
    joia.setAttribute('aria-hidden', 'true');
    const meio = { x: (origem.x + destino.x) / 2 + (i - quantas / 2) * 18, y: Math.min(origem.y, destino.y) - 120 - i * 12 };
    return passageiro(
      document.body,
      joia,
      [
        { transform: `translate(${origem.x}px, ${origem.y}px) rotate(45deg) scale(.4)`, opacity: 0 },
        { transform: `translate(${origem.x}px, ${origem.y - 20}px) rotate(45deg) scale(1)`, opacity: 1, offset: 0.12 },
        { transform: `translate(${meio.x}px, ${meio.y}px) rotate(225deg) scale(1.15)`, offset: 0.55 },
        { transform: `translate(${destino.x}px, ${destino.y}px) rotate(405deg) scale(.5)`, opacity: 0.9 },
      ],
      { duration: 620, delay: i * 55, easing: 'cubic-bezier(.45,0,.4,1)' },
    );
  });
  await Promise.all(voos);
}

/** O preço sobe do que chegou e some. */
function precoSubindo({ x, y }: PontoNaTela, preco: number): void {
  const selo = document.createElement('div');
  selo.className = 'preco-subindo';
  selo.setAttribute('aria-hidden', 'true');
  const gema = document.createElement('i');
  gema.className = 'preco-subindo-joia';
  selo.append(gema, `−${preco}`);
  void passageiro(
    document.body,
    selo,
    [
      { transform: `translate(${x}px, ${y}px) translate(-50%, 0) scale(.6)`, opacity: 0 },
      { transform: `translate(${x}px, ${y - 24}px) translate(-50%, 0) scale(1.1)`, opacity: 1, offset: 0.3 },
      { transform: `translate(${x}px, ${y - 60}px) translate(-50%, 0) scale(1)`, opacity: 0 },
    ],
    { duration: 1100, easing: 'ease-out' },
  );
}

/** Um anel de luz avisando onde a compra vai cair. */
async function luzNoLugar(camada: Element, caixa: CaixaDoDesenho, noChao: boolean): Promise<void> {
  void efeito(
    camada,
    'ellipse',
    {
      cx: caixa.x + caixa.width / 2,
      cy: noChao ? caixa.y + caixa.height - 6 : caixa.y + caixa.height / 2,
      rx: Math.max(30, caixa.width / 2.2),
      ry: Math.max(14, caixa.width / 4.6),
      fill: 'none',
      stroke: '#fff6b0',
      'stroke-width': 5,
    },
    [
      { opacity: 0, transform: 'scale(.3)' },
      { opacity: 1, transform: 'scale(1)', offset: 0.5 },
      { opacity: 0, transform: 'scale(1.15)' },
    ],
    { duration: 520, easing: 'ease-out' },
  );
  await esperar(260);
}

interface Queda {
  origem: string;
  quadros: Keyframe[];
  duracao: number;
  ritmo: string;
  /** Quando acontece o impacto. */
  impacto: number;
}

const QUEDAS: Record<TipoDeChegada, Queda> = {
  /** Abre do centro. */
  tapete: {
    origem: '50% 100%',
    quadros: [
      { transform: 'scale(.1, .1)', opacity: 0 },
      { transform: 'scale(1.12, 1.12)', opacity: 1, offset: 0.55 },
      { transform: 'scale(.95, .95)', offset: 0.78 },
      { transform: 'scale(1, 1)' },
    ],
    duracao: 620,
    ritmo: 'cubic-bezier(.2,.8,.3,1)',
    impacto: 340,
  },
  /** Desce e balança no prego. */
  parede: {
    origem: '50% 0%',
    quadros: [
      { transform: 'translateY(-60px) rotate(0deg)', opacity: 0 },
      { transform: 'translateY(6px) rotate(0deg)', opacity: 1, offset: 0.4 },
      { transform: 'translateY(0) rotate(-5deg)', offset: 0.58 },
      { transform: 'translateY(0) rotate(3deg)', offset: 0.76 },
      { transform: 'translateY(0) rotate(-1deg)', offset: 0.9 },
      { transform: 'translateY(0) rotate(0deg)' },
    ],
    duracao: 620,
    ritmo: 'cubic-bezier(.2,.8,.3,1)',
    impacto: 250,
  },
  /** Cai do alto, amassa e quica, como um brinquedo. */
  chao: {
    origem: '50% 100%',
    quadros: [
      { transform: 'translateY(-170px) scale(.9, 1.12)', opacity: 0, easing: 'cubic-bezier(.55,0,1,.45)' },
      { transform: 'translateY(-150px) scale(.9, 1.12)', opacity: 1, offset: 0.08, easing: 'cubic-bezier(.55,0,1,.45)' },
      { transform: 'translateY(0) scale(1.14, .8)', offset: 0.5, easing: 'cubic-bezier(.2,.8,.3,1)' },
      { transform: 'translateY(-14px) scale(.96, 1.05)', offset: 0.68, easing: 'cubic-bezier(.5,0,.8,.5)' },
      { transform: 'translateY(0) scale(1.04, .96)', offset: 0.84 },
      { transform: 'translateY(0) scale(1, 1)' },
    ],
    duracao: 760,
    ritmo: 'linear',
    impacto: 380,
  },
};

/** Faz a compra chegar e volta no instante do impacto. */
async function cair(alvo: SVGElement, tipo: TipoDeChegada): Promise<void> {
  const { origem, quadros, duracao, ritmo, impacto } = QUEDAS[tipo];
  apoiarEm(alvo, origem);
  void animar(alvo, quadros, { duration: duracao, easing: ritmo });
  await esperar(impacto);
}

/** Poeirinha que espirra dos pés, nos dois sentidos do chão. */
function poeira(camada: Element, caixa: CaixaDoDesenho): void {
  const x = caixa.x + caixa.width / 2;
  const y = caixa.y + caixa.height - 4;
  for (let i = 0; i < 10; i += 1) {
    const lado = i % 2 ? 1 : -1;
    const angulo = (i / 10) * Math.PI;
    const dx = lado * (30 + (i % 4) * 14);
    const dy = -10 - (i % 3) * 10 + lado * 6;
    void efeito(
      camada,
      'circle',
      {
        cx: x + lado * (caixa.width / 2) * 0.6 * Math.cos(angulo / 2),
        cy: y + (i % 3) * 3,
        r: 6 + (i % 3) * 3,
        fill: '#fff7ea',
        stroke: CONTORNO,
        'stroke-width': 2,
      },
      [
        { transform: 'translate(0,0) scale(.4)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(1.2)`, opacity: 0 },
      ],
      { duration: 620 + (i % 3) * 80, easing: 'cubic-bezier(.1,.7,.3,1)' },
    );
  }
}

/** Estrelinhas que estouram em volta do que chegou. */
function brilhos(camada: Element, caixa: CaixaDoDesenho, quantas: number): void {
  const cx = caixa.x + caixa.width / 2;
  const cy = caixa.y + caixa.height / 2;
  const raio = Math.max(caixa.width, caixa.height) / 2 + 10;
  for (let i = 0; i < quantas; i += 1) {
    const angulo = (i / quantas) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angulo) * raio;
    const y = cy + Math.sin(angulo) * raio * 0.75;
    void efeito(
      camada,
      'path',
      {
        d: `M${x} ${y - 9}l3 6 6 3-6 3-3 6-3-6-6-3 6-3z`,
        fill: CORES_DAS_ESTRELAS[i % CORES_DAS_ESTRELAS.length],
        stroke: CONTORNO,
        'stroke-width': 2,
        'stroke-linejoin': 'round',
      },
      [
        { transform: 'translate(0,0) scale(0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${Math.cos(angulo) * 14}px, ${Math.sin(angulo) * 10}px) scale(1.25) rotate(90deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${Math.cos(angulo) * 26}px, ${Math.sin(angulo) * 18 - 8}px) scale(0) rotate(180deg)`, opacity: 0 },
      ],
      { duration: 760, delay: i * 30, easing: 'cubic-bezier(.2,.8,.3,1)' },
    );
  }
}

/** O que sai: sobe num pufe de fumaça. Fica invisível até quem chamou tirar o elemento da tela. */
export async function sumir(camada: Element, alvo: SVGGraphicsElement): Promise<void> {
  const caixa = caixaDo(alvo);
  const cx = caixa.x + caixa.width / 2;
  const cy = caixa.y + caixa.height / 2;
  apoiarEm(alvo, '50% 100%');
  for (let i = 0; i < 8; i += 1) {
    const angulo = (i / 8) * Math.PI * 2;
    void efeito(
      camada,
      'circle',
      { cx, cy, r: 10 + (i % 3) * 4, fill: '#ffffff', stroke: CONTORNO, 'stroke-width': 2 },
      [
        { transform: 'translate(0,0) scale(.2)', opacity: 1 },
        { transform: `translate(${Math.cos(angulo) * 46}px, ${Math.sin(angulo) * 30}px) scale(1)`, opacity: 0 },
      ],
      { duration: 520, delay: 120, easing: 'cubic-bezier(.1,.7,.3,1)' },
    );
  }
  await animar(
    alvo,
    [
      { transform: 'scale(1, 1)', opacity: 1 },
      { transform: 'scale(1.08, .9)', opacity: 1, offset: 0.3 },
      { transform: 'translateY(-30px) scale(.6, 1.2)', opacity: 0 },
    ],
    { duration: 360, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' },
  );
}

export interface Chegada {
  camada: Element;
  alvo: SVGGraphicsElement;
  tipo: TipoDeChegada;
  preco: number;
}

/** Luz no lugar, a queda, a poeira, as estrelinhas e o preço subindo. Volta no impacto, com a caixa do que chegou. */
export async function chegar({ camada, alvo, tipo, preco }: Chegada): Promise<CaixaDoDesenho> {
  const caixa = caixaDo(alvo);
  const topo = alvo.getBoundingClientRect();
  alvo.style.opacity = '0';
  await luzNoLugar(camada, caixa, tipo !== 'parede');
  const queda = cair(alvo, tipo);
  alvo.style.opacity = '';
  await queda;
  if (tipo !== 'parede') poeira(camada, caixa);
  brilhos(camada, caixa, tipo === 'chao' ? 8 : 6);
  if (preco > 0) precoSubindo({ x: topo.left + topo.width / 2, y: topo.top }, preco);
  return caixa;
}
