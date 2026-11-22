import { Ellipse, G, Path } from 'react-native-svg';

import type { Rosto } from '../machine';
import { COR } from './geometria';

const nome = (s: string) => `peca-${s}`;
const q = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) =>
  `M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}`;

/** Cauda: polilinha grossa. Pivô em (180, 232). */
export function Cauda() {
  return (
    <G testID={nome('cauda')}>
      <Path
        d="M180 232 L206 224 L232 232 L254 224"
        stroke={COR.girino}
        strokeWidth={16}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </G>
  );
}

export function CorpoDoGirino() {
  return (
    <G testID={nome('corpo')}>
      <Ellipse cx={150} cy={232} rx={40} ry={28} fill={COR.girino} />
      <Path d={q(128, 214, 146, 204, 168, 208)} stroke={COR.branco} strokeOpacity={0.25} strokeWidth={5} strokeLinecap="round" fill="none" />
    </G>
  );
}

export function PernasDoGirino() {
  return (
    <G testID={nome('coxa-direito')}>
      <Ellipse cx={166} cy={252} rx={14} ry={8} fill={COR.girinoEscuro} transform="rotate(25 166 252)" />
      <Ellipse cx={140} cy={254} rx={14} ry={8} fill={COR.girinoEscuro} transform="rotate(-25 140 254)" />
      <Ellipse cx={122} cy={238} rx={9} ry={6} fill={COR.girinoEscuro} transform="rotate(-30 122 238)" />
    </G>
  );
}

export function OlhoDoGirino({ tipo }: { tipo: Rosto['olhos'] }) {
  let corpo;
  if (tipo === 'felizes') {
    corpo = <Path d={q(122, 224, 131, 214, 140, 224)} stroke={COR.ink} strokeWidth={3.5} strokeLinecap="round" fill="none" />;
  } else if (tipo === 'fechados') {
    corpo = <Path d={q(122, 222, 131, 230, 140, 222)} stroke={COR.ink} strokeWidth={3.5} strokeLinecap="round" fill="none" />;
  } else {
    corpo = (
      <>
        <Ellipse cx={131} cy={222} rx={10} ry={11} fill={COR.branco} />
        <Ellipse cx={133} cy={224} rx={5} ry={5.5} fill={COR.ink} />
        <Ellipse cx={135} cy={222} rx={2} ry={2} fill={COR.branco} />
      </>
    );
  }
  return <G testID={nome('olho-esquerdo')}>{corpo}</G>;
}

/** Pálpebra do girino: pivô no topo do olho (131, 211). */
export function PalpebraDoGirino() {
  return (
    <G testID={nome('palpebra-esquerda')}>
      <Ellipse cx={131} cy={222} rx={11} ry={12} fill={COR.girino} />
      <Path d={q(123, 226, 131, 231, 139, 226)} stroke={COR.ink} strokeWidth={3} strokeLinecap="round" fill="none" />
    </G>
  );
}

export function BocaDoGirino({ tipo }: { tipo: Rosto['boca'] }) {
  let corpo;
  if (tipo === 'aberta') {
    corpo = <Path d="M124 240 Q134 238 144 240 Q134 254 124 240 Z" fill={COR.ink} />;
  } else if (tipo === 'reta') {
    corpo = <Path d="M127 243 L141 243" stroke={COR.ink} strokeWidth={3.5} strokeLinecap="round" />;
  } else {
    corpo = <Path d={q(124, 240, 134, 247, 144, 240)} stroke={COR.ink} strokeWidth={3.5} strokeLinecap="round" fill="none" />;
  }
  return (
    <G testID={nome('boca')}>
      <Ellipse cx={120} cy={238} rx={6} ry={4} fill={COR.bochecha} fillOpacity={0.75} />
      {corpo}
    </G>
  );
}
