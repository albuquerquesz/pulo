import type { Rosto } from '../machine';
import { COR, CABECA, CORPO, OLHO } from './geometria';

type Lado = -1 | 1;

interface LadoProps {
  lado: Lado;
}

interface OlhoProps extends LadoProps {
  tipo: Rosto['olhos'];
}

interface BocaProps {
  tipo: Rosto['boca'];
}

interface TracoProps {
  d: string;
  w?: number;
  cor?: string;
}

interface BrilhoProps {
  x: number;
  y: number;
  s?: number;
}

const nome = (s: string) => `peca-${s}`;
const ladoNome = (s: Lado) => (s === -1 ? 'esquerdo' : 'direito');

/** Curva quadrática "M a Q c b". */
const q = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) =>
  `M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}`;

function Traco({ d, w = 5, cor = COR.ink }: TracoProps) {
  return <path d={d} stroke={cor} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
}

export function Corpo() {
  return (
    <g data-testid={nome('corpo')}>
      <ellipse cx={CORPO.cx} cy={CORPO.cy} rx={CORPO.rx} ry={CORPO.ry} fill={COR.principal} />
      {/* sombra suave na lateral */}
      <path d={q(88, 160, 82, 215, 104, 255)} stroke={COR.escura} strokeOpacity={0.35} strokeWidth={6} strokeLinecap="round" fill="none" />
      <path d={q(212, 160, 218, 215, 196, 255)} stroke={COR.escura} strokeOpacity={0.35} strokeWidth={6} strokeLinecap="round" fill="none" />
    </g>
  );
}

export function Barriga() {
  return (
    <g data-testid={nome('barriga')}>
      <ellipse cx={150} cy={CORPO.cy + CORPO.ry * 0.22} rx={CORPO.rx * 0.62} ry={CORPO.ry * 0.62} fill={COR.barriga} />
      <path d={q(122, 238, 150, 248, 178, 238)} stroke={COR.clara} strokeOpacity={0.9} strokeWidth={4} strokeLinecap="round" fill="none" />
    </g>
  );
}

export function Coxa({ lado }: LadoProps) {
  return (
    <g data-testid={nome(`coxa-${ladoNome(lado)}`)}>
      <ellipse cx={150 + lado * 64} cy={226} rx={46} ry={30} fill={COR.media} transform={`rotate(${lado * 30} ${150 + lado * 64} 226)`} />
    </g>
  );
}

export function Pe({ lado }: LadoProps) {
  const fx = 150 + lado * (64 + 46 * 0.55);
  return (
    <g data-testid={nome(`pe-${ladoNome(lado)}`)}>
      <ellipse cx={fx} cy={264} rx={30} ry={10} fill={COR.escura} />
      {(
        [
          [24, -5],
          [31, 0],
          [24, 5],
        ] as const
      ).map(([dx, dy]) => (
        <ellipse key={dy} cx={fx + lado * dx} cy={264 + dy} rx={5.5} ry={5.5} fill={COR.clara} />
      ))}
    </g>
  );
}

export function Braco({ lado }: LadoProps) {
  const sx = 150 + lado * CORPO.rx * 0.78;
  const sy = CORPO.cy - CORPO.ry * 0.25;
  const ex = 150 + lado * CORPO.rx * 0.46;
  const ey = sy + 64;
  return (
    <g data-testid={nome(`braco-${ladoNome(lado)}`)}>
      <ellipse cx={(sx + ex) / 2} cy={(sy + ey) / 2} rx={11} ry={36} fill={COR.principal} transform={`rotate(${lado * -14} ${(sx + ex) / 2} ${(sy + ey) / 2})`} />
    </g>
  );
}

export function Mao({ lado }: LadoProps) {
  const ex = 150 + lado * CORPO.rx * 0.46;
  const ey = CORPO.cy - CORPO.ry * 0.25 + 64;
  return (
    <g data-testid={nome(`mao-${ladoNome(lado)}`)}>
      <ellipse cx={ex} cy={ey + 4} rx={14} ry={8} fill={COR.principal} />
      {[-8, 0, 8].map((dx) => (
        <ellipse key={dx} cx={ex + dx} cy={ey + 11} rx={3.8} ry={3.8} fill={COR.clara} />
      ))}
    </g>
  );
}

export function Cabeca() {
  return (
    <g data-testid={nome('cabeca')}>
      <ellipse cx={CABECA.cx} cy={CABECA.cy} rx={CABECA.rx} ry={CABECA.ry} fill={COR.principal} />
      {/* luz no topo da cabeça */}
      <path d={q(96, 96, 120, 74, 160, 70)} stroke={COR.branco} strokeOpacity={0.28} strokeWidth={7} strokeLinecap="round" fill="none" />
    </g>
  );
}

export function Bochecha({ lado }: LadoProps) {
  return (
    <g data-testid={nome(`bochecha-${ladoNome(lado)}`)}>
      <ellipse cx={150 + lado * CABECA.rx * 0.78} cy={CABECA.cy + CABECA.ry * 0.38} rx={12} ry={8} fill={COR.bochecha} />
    </g>
  );
}

/** Bulbo do olho (verde), sempre presente. */
export function BulboDoOlho({ lado }: LadoProps) {
  return <ellipse cx={150 + lado * OLHO.dx} cy={OLHO.cy} rx={OLHO.r} ry={OLHO.r} fill={COR.principal} />;
}

/** Desenho do olho para o tipo do rosto. */
function DesenhoDoOlho({ lado, tipo }: OlhoProps) {
  const cx = 150 + lado * OLHO.dx;
  const cy = OLHO.cy;
  const r = OLHO.r;
  if (tipo === 'felizes') return <Traco d={q(cx - 14, cy + 6, cx, cy - 10, cx + 14, cy + 6)} />;
  if (tipo === 'fechados') return <Traco d={q(cx - 14, cy + 2, cx, cy + 13, cx + 14, cy + 2)} w={4.5} />;
  const grande = tipo === 'arregalados';
  const rx = r * (grande ? 0.86 : 0.72);
  const ry = r * (grande ? 0.9 : 0.78);
  const pup = grande ? 0.32 : 0.5;
  const [lx, ly] = tipo === 'olhando' ? [7, -7] : tipo === 'focados' ? [0, 1] : [0, 0];
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={COR.branco} />
      <ellipse cx={cx + lx} cy={cy + ly + 3} rx={rx * pup} ry={ry * pup} fill={COR.ink} />
      <ellipse cx={cx + lx + 4} cy={cy + ly - 2} rx={3.5} ry={3.5} fill={COR.branco} />
      {tipo === 'focados' && <Traco d={`M${cx + lado * 16} ${cy - 20} L${cx - lado * 14} ${cy - 12}`} />}
    </>
  );
}

/** Olho com o rosto do estado. */
export function Olho({ lado, tipo }: OlhoProps) {
  return (
    <g data-testid={nome(`olho-${ladoNome(lado)}`)}>
      <DesenhoDoOlho lado={lado} tipo={tipo} />
    </g>
  );
}

/** Pálpebra: tampa verde que desce sobre o olho aberto ao piscar. Pivô no topo do bulbo. */
export function Palpebra({ lado }: LadoProps) {
  const cx = 150 + lado * OLHO.dx;
  return (
    <g data-testid={nome(`palpebra-${ladoNome(lado)}`)}>
      <ellipse cx={cx} cy={OLHO.cy} rx={OLHO.r + 0.5} ry={OLHO.r + 0.5} fill={COR.principal} />
      <Traco d={q(cx - 14, OLHO.cy + 10, cx, OLHO.cy + 20, cx + 14, OLHO.cy + 10)} w={4.5} />
    </g>
  );
}

/** Desenho da boca para o tipo do rosto. */
function DesenhoDaBoca({ tipo }: BocaProps) {
  const hx = 150;
  const my = CABECA.cy + 8;
  if (tipo === 'sorriso') return <Traco d={q(hx - 26, my, hx, my + 22, hx + 26, my)} />;
  if (tipo === 'aberta') {
    return (
      <>
        <path d={`M${hx - 28} ${my} Q${hx} ${my + 10} ${hx + 28} ${my} Q${hx} ${my + 40} ${hx - 28} ${my} Z`} fill={COR.ink} />
        <ellipse cx={hx} cy={my + 20} rx={12} ry={6} fill="#FF7A8A" />
      </>
    );
  }
  if (tipo === 'o') return <ellipse cx={hx} cy={my + 14} rx={9} ry={11} fill={COR.ink} />;
  if (tipo === 'reta') return <Traco d={`M${hx - 12} ${my + 8} L${hx + 12} ${my + 8}`} w={4.5} />;
  return <Traco d={q(hx - 12, my + 3, hx, my + 13, hx + 12, my + 3)} w={4.5} />;
}

export function Boca({ tipo }: BocaProps) {
  return (
    <g data-testid={nome('boca')}>
      <DesenhoDaBoca tipo={tipo} />
    </g>
  );
}

// ---------- extras ----------

export function Suor() {
  const hx = 150;
  const hy = CABECA.cy;
  return (
    <g data-testid={nome('suor')}>
      <path d={`M${hx + 64} ${hy - 10} Q${hx + 78} ${hy + 14} ${hx + 64} ${hy + 20} Q${hx + 50} ${hy + 14} ${hx + 64} ${hy - 10} Z`} fill={COR.suor} />
    </g>
  );
}

export function Balao() {
  return (
    <g data-testid={nome('balao')}>
      <ellipse cx={256} cy={32} rx={38.5} ry={22.5} fill="#CFE3D4" />
      <ellipse cx={256} cy={32} rx={37} ry={21} fill={COR.branco} />
      <ellipse cx={232} cy={56} rx={7.5} ry={7.5} fill="#CFE3D4" />
      <ellipse cx={232} cy={56} rx={6.5} ry={6.5} fill={COR.branco} />
      <ellipse cx={224} cy={68} rx={5} ry={5} fill="#CFE3D4" />
      <ellipse cx={224} cy={68} rx={4} ry={4} fill={COR.branco} />
      {[242, 256, 270].map((x) => (
        <ellipse key={x} cx={x} cy={32} rx={4} ry={4} fill={COR.ink} />
      ))}
    </g>
  );
}

export function Zzz() {
  return (
    <g data-testid={nome('zzz')}>
      {(
        [
          [228, 70, 14],
          [246, 46, 18],
          [268, 20, 22],
        ] as const
      ).map(([x, y, s]) => (
        <path
          key={x}
          d={`M${x - s / 2} ${y - s / 2} L${x + s / 2} ${y - s / 2} L${x - s / 2} ${y + s / 2} L${x + s / 2} ${y + s / 2}`}
          stroke={COR.zzz}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </g>
  );
}

/** Estrelinha de 4 pontas centrada em (x, y). */
export function Brilho({ x, y, s = 10 }: BrilhoProps) {
  const k = s * 0.28;
  return (
    <polygon
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
    <g data-testid={nome('brilhos')}>
      {POSICOES_BRILHO.map(([x, y]) => (
        <Brilho key={x} x={x} y={y} />
      ))}
    </g>
  );
}

export function Impacto() {
  return (
    <g data-testid={nome('impacto')}>
      {(
        [
          [20, 262, 52, 246],
          [280, 262, 248, 246],
          [14, 240, 44, 232],
          [286, 240, 256, 232],
        ] as const
      ).map(([a, b, c, d]) => (
        <path key={a + b} d={`M${a} ${b} L${c} ${d}`} stroke={COR.impacto} strokeWidth={5} strokeLinecap="round" />
      ))}
    </g>
  );
}

/** Sombra de contato no chão. */
export function SombraNoChao() {
  return <ellipse cx={150} cy={276} rx={90} ry={6} fill="#000000" fillOpacity={0.14} />;
}
