import { caixa, face, naParedeDireita, naParedeEsquerda, projetar, type CoresDaCaixa, type Face, type Intervalo, type Ponto3d, type Volume } from './geometria';
import { CONTORNO, MOLDURA, VIDRO } from './paleta';

export function Faces({ faces, traco = 4 }: { faces: readonly Face[]; traco?: number }) {
  return faces.map((f) => <polygon key={f.pontos} points={f.pontos} fill={f.cor} stroke={CONTORNO} strokeWidth={traco} strokeLinejoin="round" />);
}

/** Caixa com a sombra interna do rascunho: uma faixa escura no pé das duas paredes. */
export function Bloco({ volume, cores }: { volume: Volume; cores: CoresDaCaixa }) {
  const { u, v, z } = volume;
  const faixa: Intervalo = [z[0], z[0] + 0.22];
  return (
    <>
      <Faces faces={caixa(volume, cores)} />
      {[naParedeEsquerda(CONTORNO, v[1], u, faixa), naParedeDireita(CONTORNO, u[1], v, faixa)].map((f) => (
        <polygon key={f.pontos} points={f.pontos} fill={f.cor} opacity=".14" />
      ))}
    </>
  );
}

/** Um vão numa parede: `esquerda` tem `v` fixo e `ao` ao longo de `u`; `direita`, o contrário. */
export interface Vao {
  parede: 'esquerda' | 'direita';
  em: number;
  ao: Intervalo;
  z: Intervalo;
}

const ponto = ({ parede, em }: Vao, ao: number, z: number): Ponto3d => (parede === 'esquerda' ? [ao, em, z] : [em, ao, z]);

const retangulo = (vao: Vao, cor: string, [a0, a1]: Intervalo, [z0, z1]: Intervalo): Face =>
  face(cor, [ponto(vao, a0, z0), ponto(vao, a1, z0), ponto(vao, a1, z1), ponto(vao, a0, z1)]);

function risco(vao: Vao, de: readonly [number, number], ate: readonly [number, number]): string {
  const a = projetar(ponto(vao, ...de));
  const b = projetar(ponto(vao, ...ate));
  return `M${a.x} ${a.y}L${b.x} ${b.y}`;
}

export const centroDoVao = (vao: Vao) => projetar(ponto(vao, (vao.ao[0] + vao.ao[1]) / 2, (vao.z[0] + vao.z[1]) / 2));

/** Janela com moldura, cruzeta e parapeito. No tema escuro o vidro acende (`.janela-vidro`). */
export function Janela(vao: Vao) {
  const { ao, z } = vao;
  const meio = (ao[0] + ao[1]) / 2;
  const altura = (z[0] + z[1]) / 2;
  const moldura = retangulo(vao, MOLDURA, [ao[0] - 0.1, ao[1] + 0.1], [z[0] - 0.1, z[1] + 0.1]);
  const vidro = retangulo(vao, VIDRO, ao, z);
  const parapeito = retangulo(vao, MOLDURA, [ao[0] - 0.18, ao[1] + 0.18], [z[0] - 0.2, z[0] - 0.08]);
  return (
    <g>
      <Faces faces={[moldura]} traco={3} />
      <polygon className="janela-vidro" points={vidro.pontos} fill={vidro.cor} stroke={CONTORNO} strokeWidth="2" strokeLinejoin="round" />
      <path d={`${risco(vao, [meio, z[0]], [meio, z[1]])}${risco(vao, [ao[0], altura], [ao[1], altura])}`} stroke={CONTORNO} strokeWidth="2" fill="none" />
      <Faces faces={[parapeito]} traco={2.5} />
    </g>
  );
}

/** Porta com moldura e maçaneta. */
export function Porta({ cor, ...vao }: Vao & { cor: string }) {
  const { ao, z } = vao;
  const macaneta = projetar(ponto(vao, ao[1] - 0.16, (z[0] + z[1]) / 2));
  return (
    <g>
      <Faces faces={[retangulo(vao, MOLDURA, [ao[0] - 0.1, ao[1] + 0.1], [z[0], z[1] + 0.12]), retangulo(vao, cor, ao, z)]} traco={3} />
      <circle cx={macaneta.x} cy={macaneta.y} r="3.5" fill="var(--pulo-sol)" stroke={CONTORNO} strokeWidth="1.5" />
    </g>
  );
}
