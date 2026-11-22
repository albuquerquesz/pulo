import type { Rosto } from '../machine';
import { COR } from './geometria';

const nome = (s: string) => `peca-${s}`;
const q = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) =>
  `M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}`;

/** Cauda: polilinha grossa. Pivô em (180, 232). */
export function Cauda() {
  return (
    <g data-testid={nome('cauda')}>
      <path
        d="M180 232 L206 224 L232 232 L254 224"
        stroke={COR.girino}
        strokeWidth={16}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </g>
  );
}

export function CorpoDoGirino() {
  return (
    <g data-testid={nome('corpo')}>
      <ellipse cx={150} cy={232} rx={40} ry={28} fill={COR.girino} />
      <path d={q(128, 214, 146, 204, 168, 208)} stroke={COR.branco} strokeOpacity={0.25} strokeWidth={5} strokeLinecap="round" fill="none" />
    </g>
  );
}

export function PernasDoGirino() {
  return (
    <g data-testid={nome('coxa-direito')}>
      <ellipse cx={166} cy={252} rx={14} ry={8} fill={COR.girinoEscuro} transform="rotate(25 166 252)" />
      <ellipse cx={140} cy={254} rx={14} ry={8} fill={COR.girinoEscuro} transform="rotate(-25 140 254)" />
      <ellipse cx={122} cy={238} rx={9} ry={6} fill={COR.girinoEscuro} transform="rotate(-30 122 238)" />
    </g>
  );
}

interface OlhoDoGirinoProps {
  tipo: Rosto['olhos'];
}

interface BocaProps {
  tipo: Rosto['boca'];
}

function DesenhoDoOlhoDoGirino({ tipo }: OlhoDoGirinoProps) {
  if (tipo === 'felizes') {
    return <path d={q(122, 224, 131, 214, 140, 224)} stroke={COR.ink} strokeWidth={3.5} strokeLinecap="round" fill="none" />;
  }
  if (tipo === 'fechados') {
    return <path d={q(122, 222, 131, 230, 140, 222)} stroke={COR.ink} strokeWidth={3.5} strokeLinecap="round" fill="none" />;
  }
  return (
    <>
      <ellipse cx={131} cy={222} rx={10} ry={11} fill={COR.branco} />
      <ellipse cx={133} cy={224} rx={5} ry={5.5} fill={COR.ink} />
      <ellipse cx={135} cy={222} rx={2} ry={2} fill={COR.branco} />
    </>
  );
}

export function OlhoDoGirino({ tipo }: OlhoDoGirinoProps) {
  return (
    <g data-testid={nome('olho-esquerdo')}>
      <DesenhoDoOlhoDoGirino tipo={tipo} />
    </g>
  );
}

/** Pálpebra do girino: pivô no topo do olho (131, 211). */
export function PalpebraDoGirino() {
  return (
    <g data-testid={nome('palpebra-esquerda')}>
      <ellipse cx={131} cy={222} rx={11} ry={12} fill={COR.girino} />
      <path d={q(123, 226, 131, 231, 139, 226)} stroke={COR.ink} strokeWidth={3} strokeLinecap="round" fill="none" />
    </g>
  );
}

function DesenhoDaBocaDoGirino({ tipo }: BocaProps) {
  if (tipo === 'aberta') return <path d="M124 240 Q134 238 144 240 Q134 254 124 240 Z" fill={COR.ink} />;
  if (tipo === 'reta') return <path d="M127 243 L141 243" stroke={COR.ink} strokeWidth={3.5} strokeLinecap="round" />;
  return <path d={q(124, 240, 134, 247, 144, 240)} stroke={COR.ink} strokeWidth={3.5} strokeLinecap="round" fill="none" />;
}

export function BocaDoGirino({ tipo }: BocaProps) {
  return (
    <g data-testid={nome('boca')}>
      <ellipse cx={120} cy={238} rx={6} ry={4} fill={COR.bochecha} fillOpacity={0.75} />
      <DesenhoDaBocaDoGirino tipo={tipo} />
    </g>
  );
}
