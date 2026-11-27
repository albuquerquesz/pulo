import { P } from './geometria';
import { TRACEJADO } from './fantasma';
import { BRANCO, CONTORNO, FOLHA, FOLHA_ESC, MADEIRA, OURO, ROSA } from './paleta';
import { Cilindro, Elipse, Linha } from './pecas';
import type { DesenhoProps, Movel } from './tipos';

/** Cada folha: deslocamento, raio e cor. */
const FOLHAS = [
  [-14, -16, 16, FOLHA_ESC],
  [14, -18, 16, FOLHA_ESC],
  [0, -34, 18, FOLHA],
  [-10, -6, 13, FOLHA],
  [12, -6, 13, FOLHA],
] as const satisfies readonly (readonly [number, number, number, string])[];

const ANGULOS_DAS_FRONDES = [200, 240, 300, 340, 20, 90];

function Folhagem({ cor }: DesenhoProps) {
  const [x, y] = P(0.1, 0.94, 40);
  return (
    <>
      <Cilindro a={0.1} b={0.94} r={0.05} h0={0} h1={40} cor={cor} />
      {FOLHAS.map(([dx, dy, r, tinta]) => (
        <Elipse key={`${dx} ${dy}`} em={[x + dx, y + dy]} rx={r} ry={r * 0.72} fill={tinta} />
      ))}
    </>
  );
}

function Cacto({ cor }: DesenhoProps) {
  const [x, y] = P(0.1, 0.94, 34);
  const braco = `M${x - 10} ${y - 26}h-8a6 6 0 0 1-6-6v-12`;
  return (
    <>
      <Cilindro a={0.1} b={0.94} r={0.045} h0={0} h1={34} cor={cor} />
      <rect x={x - 10} y={y - 58} width="20" height="62" rx="10" fill={FOLHA} stroke={CONTORNO} strokeWidth="3" />
      <path d={braco} fill="none" stroke={CONTORNO} strokeWidth="9" strokeLinecap="round" />
      <path d={braco} fill="none" stroke={FOLHA} strokeWidth="4" strokeLinecap="round" />
      <Elipse em={[x, y - 60]} rx={5} ry={5} fill={ROSA} strokeWidth="2.5" />
    </>
  );
}

function Palmeira({ cor }: DesenhoProps) {
  const [x, y] = P(0.1, 0.94, 30);
  return (
    <>
      <Cilindro a={0.1} b={0.94} r={0.05} h0={0} h1={30} cor={cor} />
      <Linha de={[x, y]} ate={[x + 4, y - 92]} largura={8} />
      <Linha de={[x, y]} ate={[x + 4, y - 92]} largura={4} cor={MADEIRA} />
      {ANGULOS_DAS_FRONDES.map((angulo) => {
        const r = (angulo * Math.PI) / 180;
        const ex = x + Math.cos(r) * 34;
        const ey = y - 92 + Math.sin(r) * 18;
        return (
          <path
            key={angulo}
            d={`M${x} ${y - 92}Q${(x + ex) / 2} ${ey - 16} ${ex} ${ey}Q${(x + ex) / 2} ${ey - 2} ${x} ${y - 92}Z`}
            fill={FOLHA}
            stroke={CONTORNO}
            strokeWidth="3"
            strokeLinejoin="round"
          />
        );
      })}
    </>
  );
}

export const PLANTA: Movel = {
  id: 'planta',
  nome: 'Planta',
  onde: 'canto da direita',
  tipo: 'chao',
  camada: 7,
  Fantasma: () => <Elipse em={P(0.1, 0.94)} rx={26} ry={13} {...TRACEJADO} strokeDasharray="6 5" />,
  modelos: [
    { id: 'planta-folhas', nome: 'Folhagem', natural: '#e9785b', Desenho: Folhagem },
    { id: 'planta-cacto', nome: 'Cacto', natural: OURO, Desenho: Cacto },
    { id: 'planta-palmeira', nome: 'Palmeira', natural: BRANCO, Desenho: Palmeira },
  ],
};
