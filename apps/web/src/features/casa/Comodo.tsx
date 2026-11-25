import type { ComodoId } from '@pulo/core/domain/casa';

import { CORES_DOS_COMODOS } from './comodos';

type Pontos = readonly (readonly [number, number])[];

const ESTRELAS: Pontos = [[170, 260], [250, 330], [320, 180], [140, 400], [330, 410], [480, 200], [560, 320], [650, 260], [620, 420], [520, 430]];
const TABUAS: Pontos = [[130, 505], [160, 520], [190, 535], [220, 550], [250, 565], [280, 580], [310, 595], [340, 610], [370, 625]];
const EMENDAS: Pontos = [[190, 445], [160, 460], [226, 427], [201, 469], [181, 479], [258, 441], [405, 397], [379, 411], [370, 415], [277, 492], [348, 456], [289, 485], [295, 512], [280, 520], [305, 508], [497, 441], [475, 453], [470, 455], [499, 471], [360, 540], [387, 527], [489, 506], [513, 494], [541, 480], [577, 492], [396, 582], [514, 523], [559, 530], [521, 549], [447, 587]];

const CONTORNO = { stroke: 'var(--pulo-contorno)', strokeWidth: 5, strokeLinejoin: 'round' } as const;
const RISCO = { stroke: 'var(--pulo-contorno)', strokeWidth: 2.5 } as const;

/** O cômodo vazio do rascunho: duas paredes em perspectiva e o chão de tábuas, nas cores do cômodo. */
export function Comodo({ comodo }: { comodo: ComodoId }) {
  const cores = CORES_DOS_COMODOS[comodo];
  return (
    <g aria-hidden="true" data-testid="comodo" data-comodo={comodo}>
      <polygon points="100,490 400,340 400,40 100,190" fill={cores.paredeEsquerda} {...CONTORNO} />
      <polygon points="400,340 700,490 700,190 400,40" fill={cores.paredeDireita} {...CONTORNO} />
      <path d="M100 190L400 40L700 190" fill="none" stroke={cores.rodape} strokeWidth="10" strokeLinejoin="round" />
      <path d="M95 192L400 38L705 192" fill="none" stroke="var(--pulo-contorno)" strokeWidth="3" strokeLinejoin="round" />
      {ESTRELAS.map(([x, y]) => (
        <path key={`${x} ${y}`} d={`M${x} ${y}l3 7 7 3-7 3-3 7-3-7-7-3 7-3z`} fill="var(--pulo-timer-ouro)" opacity=".45" />
      ))}
      <polygon points="100,490 400,640 400,664 100,514" fill={cores.baseEsquerda} {...CONTORNO} />
      <polygon points="400,640 700,490 700,514 400,664" fill={cores.baseDireita} {...CONTORNO} />
      <polygon points="400,340 700,490 400,640 100,490" fill={cores.piso} {...CONTORNO} />
      {TABUAS.map(([x, y]) => (
        <path key={`${x} ${y}`} d={`M${x} ${y}l300 -150`} strokeOpacity=".35" {...RISCO} />
      ))}
      {EMENDAS.map(([x, y]) => (
        <path key={`${x} ${y}`} d={`M${x} ${y}l30 15`} strokeOpacity=".3" {...RISCO} />
      ))}
    </g>
  );
}
