import { Ellipse, G, Path, Polygon } from 'react-native-svg';

import type { Rosto } from '../machine';
import { COR, CABECA, CORPO, OLHO } from './geometria';

type Lado = -1 | 1;
const LADOS: Lado[] = [-1, 1];
const nome = (s: string) => `peca-${s}`;
const ladoNome = (s: Lado) => (s === -1 ? 'esquerdo' : 'direito');

/** Curva quadrática "M a Q c b". */
const q = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) =>
  `M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}`;

function Traco({ d, w = 5, cor = COR.ink }: { d: string; w?: number; cor?: string }) {
  return <Path d={d} stroke={cor} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
}

export function Corpo() {
  return (
    <G testID={nome('corpo')}>
      <Ellipse cx={CORPO.cx} cy={CORPO.cy} rx={CORPO.rx} ry={CORPO.ry} fill={COR.principal} />
      {/* sombra suave na lateral */}
      <Path d={q(88, 160, 82, 215, 104, 255)} stroke={COR.escura} strokeOpacity={0.35} strokeWidth={6} strokeLinecap="round" fill="none" />
      <Path d={q(212, 160, 218, 215, 196, 255)} stroke={COR.escura} strokeOpacity={0.35} strokeWidth={6} strokeLinecap="round" fill="none" />
    </G>
  );
}

export function Barriga() {
  return (
    <G testID={nome('barriga')}>
      <Ellipse cx={150} cy={CORPO.cy + CORPO.ry * 0.22} rx={CORPO.rx * 0.62} ry={CORPO.ry * 0.62} fill={COR.barriga} />
      <Path d={q(122, 238, 150, 248, 178, 238)} stroke={COR.clara} strokeOpacity={0.9} strokeWidth={4} strokeLinecap="round" fill="none" />
    </G>
  );
}

export function Coxa({ lado }: { lado: Lado }) {
  return (
    <G testID={nome(`coxa-${ladoNome(lado)}`)}>
      <Ellipse cx={150 + lado * 64} cy={226} rx={46} ry={30} fill={COR.media} transform={`rotate(${lado * 30} ${150 + lado * 64} 226)`} />
    </G>
  );
}

export function Pe({ lado }: { lado: Lado }) {
  const fx = 150 + lado * (64 + 46 * 0.55);
  return (
    <G testID={nome(`pe-${ladoNome(lado)}`)}>
      <Ellipse cx={fx} cy={264} rx={30} ry={10} fill={COR.escura} />
      {(
        [
          [24, -5],
          [31, 0],
          [24, 5],
        ] as const
      ).map(([dx, dy]) => (
        <Ellipse key={dy} cx={fx + lado * dx} cy={264 + dy} rx={5.5} ry={5.5} fill={COR.clara} />
      ))}
    </G>
  );
}

export function Braco({ lado }: { lado: Lado }) {
  const sx = 150 + lado * CORPO.rx * 0.78;
  const sy = CORPO.cy - CORPO.ry * 0.25;
  const ex = 150 + lado * CORPO.rx * 0.46;
  const ey = sy + 64;
  return (
    <G testID={nome(`braco-${ladoNome(lado)}`)}>
      <Ellipse cx={(sx + ex) / 2} cy={(sy + ey) / 2} rx={11} ry={36} fill={COR.principal} transform={`rotate(${lado * -14} ${(sx + ex) / 2} ${(sy + ey) / 2})`} />
    </G>
  );
}

export function Mao({ lado }: { lado: Lado }) {
  const ex = 150 + lado * CORPO.rx * 0.46;
  const ey = CORPO.cy - CORPO.ry * 0.25 + 64;
  return (
    <G testID={nome(`mao-${ladoNome(lado)}`)}>
      <Ellipse cx={ex} cy={ey + 4} rx={14} ry={8} fill={COR.principal} />
      {[-8, 0, 8].map((dx) => (
        <Ellipse key={dx} cx={ex + dx} cy={ey + 11} rx={3.8} ry={3.8} fill={COR.clara} />
      ))}
    </G>
  );
}

export function Cabeca() {
  return (
    <G testID={nome('cabeca')}>
      <Ellipse cx={CABECA.cx} cy={CABECA.cy} rx={CABECA.rx} ry={CABECA.ry} fill={COR.principal} />
      {/* luz no topo da cabeça */}
      <Path d={q(96, 96, 120, 74, 160, 70)} stroke={COR.branco} strokeOpacity={0.28} strokeWidth={7} strokeLinecap="round" fill="none" />
    </G>
  );
}

export function Bochecha({ lado }: { lado: Lado }) {
  return (
    <G testID={nome(`bochecha-${ladoNome(lado)}`)}>
      <Ellipse cx={150 + lado * CABECA.rx * 0.78} cy={CABECA.cy + CABECA.ry * 0.38} rx={12} ry={8} fill={COR.bochecha} />
    </G>
  );
}

/** Bulbo do olho (verde), sempre presente. */
export function BulboDoOlho({ lado }: { lado: Lado }) {
  return <Ellipse cx={150 + lado * OLHO.dx} cy={OLHO.cy} rx={OLHO.r} ry={OLHO.r} fill={COR.principal} />;
}

/** Olho com o rosto do estado. */
export function Olho({ lado, tipo }: { lado: Lado; tipo: Rosto['olhos'] }) {
  const cx = 150 + lado * OLHO.dx;
  const cy = OLHO.cy;
  const r = OLHO.r;
  let corpo;
  if (tipo === 'felizes') {
    corpo = <Traco d={q(cx - 14, cy + 6, cx, cy - 10, cx + 14, cy + 6)} />;
  } else if (tipo === 'fechados') {
    corpo = <Traco d={q(cx - 14, cy + 2, cx, cy + 13, cx + 14, cy + 2)} w={4.5} />;
  } else {
    const grande = tipo === 'arregalados';
    const rx = r * (grande ? 0.86 : 0.72);
    const ry = r * (grande ? 0.9 : 0.78);
    const pup = grande ? 0.32 : 0.5;
    const [lx, ly] = tipo === 'olhando' ? [7, -7] : tipo === 'focados' ? [0, 1] : [0, 0];
    corpo = (
      <>
        <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={COR.branco} />
        <Ellipse cx={cx + lx} cy={cy + ly + 3} rx={rx * pup} ry={ry * pup} fill={COR.ink} />
        <Ellipse cx={cx + lx + 4} cy={cy + ly - 2} rx={3.5} ry={3.5} fill={COR.branco} />
        {tipo === 'focados' && (
          <Traco d={`M${cx + lado * 16} ${cy - 20} L${cx - lado * 14} ${cy - 12}`} />
        )}
      </>
    );
  }
  return <G testID={nome(`olho-${ladoNome(lado)}`)}>{corpo}</G>;
}

/** Pálpebra: tampa verde que desce sobre o olho aberto ao piscar. Pivô no topo do bulbo. */
export function Palpebra({ lado }: { lado: Lado }) {
  const cx = 150 + lado * OLHO.dx;
  return (
    <G testID={nome(`palpebra-${ladoNome(lado)}`)}>
      <Ellipse cx={cx} cy={OLHO.cy} rx={OLHO.r + 0.5} ry={OLHO.r + 0.5} fill={COR.principal} />
      <Traco d={q(cx - 14, OLHO.cy + 10, cx, OLHO.cy + 20, cx + 14, OLHO.cy + 10)} w={4.5} />
    </G>
  );
}

export function Boca({ tipo }: { tipo: Rosto['boca'] }) {
  const hx = 150;
  const my = CABECA.cy + 8;
  let corpo;
  switch (tipo) {
    case 'sorriso':
      corpo = <Traco d={q(hx - 26, my, hx, my + 22, hx + 26, my)} />;
      break;
    case 'aberta':
      corpo = (
        <>
          <Path d={`M${hx - 28} ${my} Q${hx} ${my + 10} ${hx + 28} ${my} Q${hx} ${my + 40} ${hx - 28} ${my} Z`} fill={COR.ink} />
          <Ellipse cx={hx} cy={my + 20} rx={12} ry={6} fill="#FF7A8A" />
        </>
      );
      break;
    case 'o':
      corpo = <Ellipse cx={hx} cy={my + 14} rx={9} ry={11} fill={COR.ink} />;
      break;
    case 'reta':
      corpo = <Traco d={`M${hx - 12} ${my + 8} L${hx + 12} ${my + 8}`} w={4.5} />;
      break;
    default:
      corpo = <Traco d={q(hx - 12, my + 3, hx, my + 13, hx + 12, my + 3)} w={4.5} />;
  }
  return <G testID={nome('boca')}>{corpo}</G>;
}

// ---------- extras ----------

export function Suor() {
  const hx = 150;
  const hy = CABECA.cy;
  return (
    <G testID={nome('suor')}>
      <Path d={`M${hx + 64} ${hy - 10} Q${hx + 78} ${hy + 14} ${hx + 64} ${hy + 20} Q${hx + 50} ${hy + 14} ${hx + 64} ${hy - 10} Z`} fill={COR.suor} />
    </G>
  );
}

export function Balao() {
  return (
    <G testID={nome('balao')}>
      <Ellipse cx={256} cy={32} rx={38.5} ry={22.5} fill="#CFE3D4" />
      <Ellipse cx={256} cy={32} rx={37} ry={21} fill={COR.branco} />
      <Ellipse cx={232} cy={56} rx={7.5} ry={7.5} fill="#CFE3D4" />
      <Ellipse cx={232} cy={56} rx={6.5} ry={6.5} fill={COR.branco} />
      <Ellipse cx={224} cy={68} rx={5} ry={5} fill="#CFE3D4" />
      <Ellipse cx={224} cy={68} rx={4} ry={4} fill={COR.branco} />
      {[242, 256, 270].map((x) => (
        <Ellipse key={x} cx={x} cy={32} rx={4} ry={4} fill={COR.ink} />
      ))}
    </G>
  );
}

export function Zzz() {
  return (
    <G testID={nome('zzz')}>
      {(
        [
          [228, 70, 14],
          [246, 46, 18],
          [268, 20, 22],
        ] as const
      ).map(([x, y, s]) => (
        <Path
          key={x}
          d={`M${x - s / 2} ${y - s / 2} L${x + s / 2} ${y - s / 2} L${x - s / 2} ${y + s / 2} L${x + s / 2} ${y + s / 2}`}
          stroke={COR.zzz}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </G>
  );
}

/** Estrelinha de 4 pontas centrada em (x, y). */
export function Brilho({ x, y, s = 10 }: { x: number; y: number; s?: number }) {
  const k = s * 0.28;
  return (
    <Polygon
      points={`${x},${y - s} ${x + k},${y - k} ${x + s},${y} ${x + k},${y + k} ${x},${y + s} ${x - k},${y + k} ${x - s},${y} ${x - k},${y - k}`}
      fill={COR.brilho}
    />
  );
}

export const POSICOES_BRILHO = [
  [40, 70],
  [262, 80],
  [60, 30],
] as const;

export function Brilhos() {
  return (
    <G testID={nome('brilhos')}>
      {POSICOES_BRILHO.map(([x, y]) => (
        <Brilho key={x} x={x} y={y} />
      ))}
    </G>
  );
}

export function Impacto() {
  return (
    <G testID={nome('impacto')}>
      {(
        [
          [20, 262, 52, 246],
          [280, 262, 248, 246],
          [14, 240, 44, 232],
          [286, 240, 256, 232],
        ] as const
      ).map(([a, b, c, d]) => (
        <Path key={a + b} d={`M${a} ${b} L${c} ${d}`} stroke={COR.impacto} strokeWidth={5} strokeLinecap="round" />
      ))}
    </G>
  );
}

/** Sombra de contato no chão. */
export function SombraNoChao() {
  return <Ellipse cx={150} cy={276} rx={90} ry={6} fill="#000000" fillOpacity={0.14} />;
}
