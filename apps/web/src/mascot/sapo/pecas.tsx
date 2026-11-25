import type { Boca as TipoDeBoca, Olhos, Sobrancelhas as TipoDeSobrancelha } from '../machine';
import { COR, CABECA, CORPO, OLHO, OMBRO, TOKEN, type BracoNaPose, type Ponto } from './geometria';

type Lado = -1 | 1;

interface LadoProps {
  lado: Lado;
}

interface OlhoProps extends LadoProps {
  tipo: Olhos;
}

interface BocaProps {
  tipo: TipoDeBoca;
}

interface SobrancelhasProps {
  tipo: TipoDeSobrancelha;
}

interface BracoDaPoseProps extends LadoProps {
  pose: BracoNaPose;
}

interface CirculoProps {
  cx: number;
  cy: number;
  r: number;
}

interface MeioFechadoProps extends LadoProps {
  fora: number;
  dentro: number;
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

/** Pupila com dois reflexos. O grupo é o que se mexe no olhar de lado. */
function Pupila({ cx, cy, r }: CirculoProps) {
  return (
    <g className="sapo-pupila">
      <circle cx={cx} cy={cy} r={r} fill={COR.ink} />
      <circle cx={cx + r * 0.4} cy={cy - r * 0.45} r={r * 0.36} fill={COR.branco} />
      <circle cx={cx - r * 0.42} cy={cy + r * 0.4} r={r * 0.16} fill={COR.branco} />
    </g>
  );
}

/**
 * Olho com a pálpebra caindo: o topo é uma linha reta de `fora` até `dentro` (alturas relativas ao centro)
 * e a base é arredondada.
 */
function OlhoMeioFechado({ lado, fora, dentro }: MeioFechadoProps) {
  const cx = 150 + lado * OLHO.dx;
  const cy = OLHO.cy + 4;
  const rx = 20;
  const [xFora, xDentro] = [cx + lado * rx, cx - lado * rx];
  const [yFora, yDentro] = [cy + fora, cy + dentro];
  return (
    <>
      <path d={`M${xFora} ${yFora} L${xDentro} ${yDentro} C${xDentro} ${cy + 28} ${xFora} ${cy + 28} ${xFora} ${yFora} Z`} fill={COR.branco} />
      <Pupila cx={cx - lado * 2} cy={cy + 8} r={10} />
      <Traco d={`M${xFora + lado * 3} ${yFora} L${xDentro - lado * 2} ${yDentro}`} w={5} />
    </>
  );
}

/** Espiral de duas voltas, espelhada em cada olho. */
function espiral(cx: number, cy: number, lado: Lado): string {
  const pontos = Array.from({ length: 49 }, (_, i) => {
    const angulo = (i / 48) * Math.PI * 4;
    const raio = 1.5 + (i / 48) * 13;
    return `${(cx - lado * Math.cos(angulo) * raio).toFixed(1)} ${(cy + Math.sin(angulo) * raio).toFixed(1)}`;
  });
  return `M${pontos.join(' L')}`;
}

/** Desenho do olho para o tipo do rosto. */
function DesenhoDoOlho({ lado, tipo }: OlhoProps) {
  const cx = 150 + lado * OLHO.dx;
  const cy = OLHO.cy;
  const r = OLHO.r;
  if (tipo === 'felizes') return <Traco d={q(cx - 15, cy + 6, cx, cy - 14, cx + 15, cy + 6)} w={6} />;
  if (tipo === 'fechados') return <Traco d={q(cx - 14, cy + 2, cx, cy + 13, cx + 14, cy + 2)} w={4.5} />;
  if (tipo === 'apertados') {
    return <Traco d={`M${cx + lado * 13} ${cy - 11} L${cx - lado * 9} ${cy + 1} L${cx + lado * 13} ${cy + 13}`} w={6} />;
  }
  if (tipo === 'caidos') return <OlhoMeioFechado lado={lado} fora={4} dentro={-12} />;
  if (tipo === 'orgulhosos') return <OlhoMeioFechado lado={lado} fora={-1} dentro={1} />;
  if (tipo === 'espiral') {
    return (
      <>
        <circle cx={cx} cy={cy} r={20} fill={COR.branco} />
        <g className="sapo-espiral" style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <Traco d={espiral(cx, cy, lado)} w={3.2} />
        </g>
      </>
    );
  }
  if (tipo === 'preocupados') {
    return (
      <>
        <ellipse cx={cx} cy={cy + 6} rx={18} ry={18} fill={COR.branco} />
        <Pupila cx={cx - lado * 3} cy={cy + 8} r={8.5} />
      </>
    );
  }
  if (tipo === 'desiguais') {
    const grande = lado === 1;
    return (
      <>
        <circle cx={cx} cy={grande ? cy : cy + 5} r={grande ? 23 : 14} fill={COR.branco} />
        <Pupila cx={cx} cy={grande ? cy + 2 : cy + 6} r={grande ? 8 : 7} />
      </>
    );
  }
  const grande = tipo === 'arregalados';
  const rx = r * (grande ? 0.86 : 0.72);
  const ry = r * (grande ? 0.9 : 0.78);
  const pup = grande ? 0.32 : 0.5;
  const [lx, ly] = tipo === 'olhando' ? [7, -7] : tipo === 'focados' ? [0, 1] : [0, 0];
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={COR.branco} />
      <g className="sapo-pupila">
        <ellipse cx={cx + lx} cy={cy + ly + 3} rx={rx * pup} ry={ry * pup} fill={COR.ink} />
        <ellipse cx={cx + lx + 4} cy={cy + ly - 2} rx={3.5} ry={3.5} fill={COR.branco} />
      </g>
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
  if (tipo === 'triste') return <Traco d={q(hx - 20, my + 19, hx, my - 1, hx + 20, my + 19)} w={5.5} />;
  if (tipo === 'ondulada') return <Traco d={`M${hx - 24} ${my + 12} q8 -11 16 0 t16 0 t16 0`} w={4.5} />;
  if (tipo === 'lado') return <Traco d={`M${hx - 14} ${my + 14} Q${hx + 8} ${my + 15} ${hx + 24} ${my + 1}`} />;
  if (tipo === 'orgulhosa') {
    return (
      <>
        <Traco d={q(hx - 30, my + 2, hx + 2, my + 28, hx + 30, my - 2)} w={5.5} />
        <Traco d={q(hx + 24, my - 5, hx + 33, my - 4, hx + 35, my + 5)} w={4} />
      </>
    );
  }
  if (tipo === 'tremida') {
    return (
      <>
        <rect x={hx - 25} y={my + 1} width={50} height={22} rx={10} fill={COR.branco} stroke={COR.ink} strokeWidth={4.5} />
        <Traco d={`M${hx - 24} ${my + 12} l8 -5 l8 10 l8 -10 l8 10 l8 -10 l8 5`} w={3} />
      </>
    );
  }
  if (tipo === 'lingua') {
    return (
      <>
        <path d={`M${hx + 3} ${my + 11} Q${hx + 5} ${my + 29} ${hx + 16} ${my + 26} Q${hx + 26} ${my + 22} ${hx + 22} ${my + 7} Z`} fill={TOKEN.rosa} stroke={COR.ink} strokeWidth={4} strokeLinejoin="round" />
        <Traco d={q(hx - 22, my + 4, hx + 2, my + 19, hx + 26, my + 3)} />
      </>
    );
  }
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

export function Sobrancelhas({ tipo }: SobrancelhasProps) {
  if (tipo === 'nenhuma') return null;
  return (
    <g data-testid={nome('sobrancelhas')}>
      {([-1, 1] as const).map((lado) => {
        const cx = 150 + lado * OLHO.dx;
        const [fora, dentro] = [cx + lado * 19, cx - lado * 15];
        if (tipo === 'preocupadas') return <Traco key={lado} d={q(fora, 47, cx - lado * 4, 42, dentro, 32)} w={6} />;
        if (tipo === 'tristes') return <Traco key={lado} d={q(fora, 48, cx + lado * 6, 34, dentro, 34)} w={6} />;
        if (lado === 1) return <Traco key={lado} d={q(fora, 36, cx, 24, dentro, 34)} w={6} />;
        return <Traco key={lado} d={`M${fora} 45 L${dentro} 49`} w={6} />;
      })}
    </g>
  );
}

// ---------- poses ----------

/** Braço dobrado de uma pose: contorno escuro por baixo, para aparecer na frente do corpo, e a mão com dedos. */
export function BracoDaPose({ lado, pose }: BracoDaPoseProps) {
  const ombro: Ponto = lado === -1 ? OMBRO.esquerdo : OMBRO.direito;
  const [mx, my] = pose.mao;
  const [cx, cy] = pose.cotovelo;
  const d = q(ombro[0], ombro[1], cx, cy, mx, my);
  // Os dedos apontam para onde o braço vai.
  const rumo = Math.atan2(my - cy, mx - cx);
  return (
    <>
      <g data-testid={nome(`braco-${ladoNome(lado)}`)}>
        <Traco d={d} w={27} cor={COR.escura} />
        <Traco d={d} w={20} cor={COR.principal} />
      </g>
      <g data-testid={nome(`mao-${ladoNome(lado)}`)}>
        <circle cx={mx} cy={my} r={14} fill={COR.principal} stroke={COR.escura} strokeWidth={3.5} />
        {[-0.75, 0, 0.75].map((abertura) => (
          <circle
            key={abertura}
            cx={mx + Math.cos(rumo + abertura) * 14}
            cy={my + Math.sin(rumo + abertura) * 14}
            r={5.5}
            fill={COR.clara}
            stroke={COR.escura}
            strokeWidth={2}
          />
        ))}
      </g>
    </>
  );
}

/** Antena de folha murcha: o talo sai da mão direita, dobra no alto e a folha pende. */
export function Antena() {
  const talo = 'M238 214 L242 176 Q248 92 262 62 Q276 38 284 70';
  return (
    <g data-testid={nome('antena')}>
      <Traco d={talo} w={10} cor={TOKEN.contorno} />
      <Traco d={talo} w={5} cor={TOKEN.talo} />
      <g className="sapo-folha" style={{ transformOrigin: '284px 70px' }}>
        <path d="M284 68 C262 80 262 112 286 134 C308 112 308 84 284 68 Z" fill={TOKEN.folhaMurcha} stroke={TOKEN.contorno} strokeWidth={4} strokeLinejoin="round" />
        <Traco d="M284 76 Q282 100 286 124" w={3} cor={TOKEN.contorno} />
      </g>
      {/* o sinal que não chega */}
      <g className="sapo-sinal">
        <Traco d="M236 36 Q248 20 268 18" w={5} cor={TOKEN.metal} />
        <Traco d="M222 22 Q238 0 266 0" w={5} cor={TOKEN.metal} />
      </g>
    </g>
  );
}

/** Martelo na mão direita, com a cabeça para o alto. */
export function Martelo() {
  return (
    <g data-testid={nome('martelo')}>
      <Traco d="M244 182 L270 108" w={17} cor={TOKEN.contorno} />
      <Traco d="M244 182 L270 108" w={10} cor={TOKEN.madeira} />
      <g transform="rotate(19 272 102)">
        <rect x={238} y={84} width={66} height={34} rx={9} fill={TOKEN.metal} stroke={TOKEN.contorno} strokeWidth={4.5} />
        <path d="M246 92 L292 92" stroke={COR.branco} strokeOpacity={0.6} strokeWidth={4} strokeLinecap="round" />
      </g>
    </g>
  );
}

/** Tábua com prego, no chão à direita: é nela que o martelo bate. */
export function Tabua() {
  return (
    <g data-testid={nome('tabua')}>
      <rect x={234} y={248} width={66} height={24} rx={5} fill={TOKEN.madeiraClara} stroke={TOKEN.contorno} strokeWidth={4.5} />
      <Traco d="M244 261 L266 261 M276 256 L290 256" w={3} cor={TOKEN.madeiraEscura} />
      <Traco d="M272 247 L272 236 M264 235 L280 235" w={5} cor={TOKEN.contorno} />
    </g>
  );
}

// ---------- extras ----------

/** Lágrima grossa no canto do olho esquerdo. */
export function Gota() {
  return (
    <g data-testid={nome('gota')}>
      <path d="M92 84 Q112 112 98 122 Q84 130 76 116 Q72 104 92 84 Z" fill={TOKEN.azul} stroke={TOKEN.contorno} strokeWidth={3.5} strokeLinejoin="round" />
      <path d="M85 108 Q82 116 89 119" stroke={COR.branco} strokeWidth={3.5} strokeLinecap="round" fill="none" />
    </g>
  );
}

export function Interrogacao() {
  const gancho = 'M38 34 Q38 12 60 12 Q82 12 82 31 Q82 43 68 50 Q60 55 60 66';
  return (
    <g data-testid={nome('interrogacao')}>
      <Traco d={gancho} w={17} cor={TOKEN.contorno} />
      <Traco d={gancho} w={9} cor={TOKEN.sol} />
      <circle cx={60} cy={88} r={8} fill={TOKEN.sol} stroke={TOKEN.contorno} strokeWidth={4} />
    </g>
  );
}

const PAPEIS = [
  [26, 34, -30, TOKEN.foco],
  [74, 8, 20, TOKEN.sol],
  [150, -2, -15, TOKEN.azul],
  [226, 10, 35, TOKEN.rosa],
  [276, 40, -25, TOKEN.agua],
  [14, 148, 40, TOKEN.descanso],
  [286, 150, 15, TOKEN.solQuente],
  [30, 212, -20, TOKEN.agua],
  [272, 214, 30, TOKEN.foco],
] as const;

export function Confete() {
  return (
    <g data-testid={nome('confete')}>
      {PAPEIS.map(([x, y, giro, cor], i) => (
        <g key={x} className="sapo-papel" style={{ animationDelay: `${(i % 4) * -350}ms` }}>
          {i % 3 === 2 ? (
            <circle cx={x} cy={y} r={6} fill={cor} />
          ) : (
            <rect x={x - 5} y={y - 9} width={10} height={18} rx={3} fill={cor} transform={`rotate(${giro} ${x} ${y})`} />
          )}
        </g>
      ))}
    </g>
  );
}

export function Cachecol() {
  const volta = 'M82 145 Q150 188 218 145 L224 166 Q150 214 76 166 Z';
  return (
    <g data-testid={nome('cachecol')}>
      <path d="M184 172 L214 164 L226 222 Q210 232 194 226 Z" fill={TOKEN.aguaBorda} stroke={TOKEN.contorno} strokeWidth={4.5} strokeLinejoin="round" />
      <Traco d="M193 206 L220 200" w={7} cor={TOKEN.listra} />
      <Traco d="M198 229 L198 240 M210 229 L212 240 M221 225 L225 235" w={4} cor={TOKEN.aguaBorda} />
      <path d={volta} fill={TOKEN.agua} stroke={TOKEN.contorno} strokeWidth={4.5} strokeLinejoin="round" />
      <Traco d="M104 164 L99 181 M138 175 L137 193 M172 173 L175 191" w={7} cor={TOKEN.listra} />
    </g>
  );
}

/** Riscos de tremedeira dos dois lados. */
export function Tremor() {
  return (
    <g data-testid={nome('tremor')}>
      <Traco d="M44 104 q-12 10 0 20 q12 10 0 20 M24 118 q-9 8 0 16" w={5} cor={TOKEN.agua} />
      <Traco d="M256 104 q12 10 0 20 q-12 10 0 20 M276 118 q9 8 0 16" w={5} cor={TOKEN.agua} />
    </g>
  );
}

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
