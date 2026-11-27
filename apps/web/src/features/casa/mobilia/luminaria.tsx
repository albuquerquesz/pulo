import { P, type Ponto } from './geometria';
import { TRACEJADO } from './fantasma';
import { BRANCO, MADEIRA, MADEIRA_ESC, OURO, ROSA } from './paleta';
import { Caixa, Cilindro, Cone, Elipse, Linha } from './pecas';
import type { DesenhoProps, Movel } from './tipos';

type LuzProps = { em: Ponto; rx: number; ry: number };

function Luz({ em: [x, y], rx, ry }: LuzProps) {
  return <ellipse className="mobilia-luz" cx={x} cy={y} rx={rx} ry={ry} fill="#fff4b0" opacity=".35" />;
}

function DePe({ cor }: DesenhoProps) {
  const [x, y] = P(0.1, 0.36, 128);
  return (
    <>
      <Luz em={[x, y + 20]} rx={70} ry={50} />
      <Cilindro a={0.1} b={0.36} r={0.045} h0={0} h1={6} cor={MADEIRA_ESC} />
      <Linha de={P(0.1, 0.36, 6)} ate={P(0.1, 0.36, 116)} largura={8} />
      <Linha de={P(0.1, 0.36, 6)} ate={P(0.1, 0.36, 116)} cor="#8d7f72" />
      <Cone a={0.1} b={0.36} r0={0.07} r1={0.04} h0={110} h1={146} cor={cor} />
    </>
  );
}

function Abajur({ cor }: DesenhoProps) {
  const [x, y] = P(0.1, 0.36, 74);
  return (
    <>
      <Luz em={[x, y + 10]} rx={52} ry={36} />
      <Caixa a={0.03} b={0.3} da={0.13} db={0.12} h0={0} h1={44} cor={MADEIRA} />
      <Cilindro a={0.1} b={0.36} r={0.022} h0={44} h1={64} cor={BRANCO} />
      <Cone a={0.1} b={0.36} r0={0.05} r1={0.032} h0={62} h1={84} cor={cor} />
    </>
  );
}

export const LUMINARIA: Movel = {
  id: 'luminaria',
  nome: 'Luminária',
  onde: 'canto do fundo, entre as paredes',
  tipo: 'chao',
  camada: 3,
  Fantasma: () => <Elipse em={P(0.1, 0.36)} rx={26} ry={13} {...TRACEJADO} strokeDasharray="6 5" />,
  modelos: [
    { id: 'luminaria-pe', nome: 'De pé', natural: OURO, Desenho: DePe },
    { id: 'luminaria-abajur', nome: 'Abajur', natural: ROSA, Desenho: Abajur },
  ],
};
