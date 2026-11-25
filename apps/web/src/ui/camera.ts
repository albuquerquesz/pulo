/**
 * Câmera das cenas em SVG (Casa e Ilha): um centro e uma largura em unidades do desenho; a altura vem da proporção do
 * contêiner. Tudo puro: o hook `useCamera` só liga estes cálculos aos eventos.
 */
export interface Camera {
  cx: number;
  cy: number;
  /** Largura da área visível, em unidades do desenho. Menor = mais perto. */
  w: number;
}

export interface LimitesDaCamera {
  /** Centro e largura na abertura; `wEstreito` vale para contêineres quase quadrados ou em pé. */
  cx: number;
  cy: number;
  w: number;
  wEstreito: number;
  min: number;
  max: number;
  /** Até onde o centro pode ir. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface Tamanho {
  largura: number;
  altura: number;
}

/** Caixa do contêiner na tela (o `DOMRect` serve). */
export interface CaixaNaTela {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Ponto {
  x: number;
  y: number;
}

const PROPORCAO_ESTREITA = 1.1;
/** Cada passo da rodinha aproxima ou afasta 10%. */
export const PASSO_DA_RODINHA = 1.1;

const limitar = (valor: number, menor: number, maior: number) => Math.min(maior, Math.max(menor, valor));

export function cameraInicial(limites: LimitesDaCamera, { largura, altura }: Tamanho): Camera {
  return { cx: limites.cx, cy: limites.cy, w: largura / altura < PROPORCAO_ESTREITA ? limites.wEstreito : limites.w };
}

export function viewBoxDe({ cx, cy, w }: Camera, { largura, altura }: Tamanho): string {
  const h = (w * altura) / largura;
  return `${cx - w / 2} ${cy - h / 2} ${w} ${h}`;
}

/** O ponto do desenho que está sob um ponto da tela. */
export function pontoNaCena({ cx, cy, w }: Camera, caixa: CaixaNaTela, tela: Ponto): Ponto {
  const h = (w * caixa.height) / caixa.width;
  return {
    x: cx - w / 2 + ((tela.x - caixa.left) / caixa.width) * w,
    y: cy - h / 2 + ((tela.y - caixa.top) / caixa.height) * h,
  };
}

/** Multiplica a largura por `fator` (menor que 1 aproxima) sem tirar do lugar o ponto sob o ponteiro. */
export function zoomNoPonto(camera: Camera, limites: LimitesDaCamera, caixa: CaixaNaTela, tela: Ponto, fator: number): Camera {
  const w = limitar(camera.w * fator, limites.min, limites.max);
  const k = w / camera.w;
  const p = pontoNaCena(camera, caixa, tela);
  return { cx: p.x + (camera.cx - p.x) * k, cy: p.y + (camera.cy - p.y) * k, w };
}

/** Arrasta a partir de onde o gesto começou: `dx` e `dy` em pixels da tela. */
export function arrastar(inicio: Camera, limites: LimitesDaCamera, larguraNaTela: number, dx: number, dy: number): Camera {
  const escala = inicio.w / larguraNaTela;
  return {
    w: inicio.w,
    cx: limitar(inicio.cx - dx * escala, limites.x0, limites.x1),
    cy: limitar(inicio.cy - dy * escala, limites.y0, limites.y1),
  };
}
