import type { Ref, SVGProps } from 'react';

import { casaCompleta, type ParteId } from '@pulo/core/domain/casa';

import { cor } from '../cores';
import { ARTE_DA_CONSTRUCAO, type Arte } from './construcao';
import { ARTE_DO_EXTERIOR } from './exterior';
import { caixa, projetar } from './geometria';
import { CONTORNO, GRAMA, MADEIRA, PEDRA } from './paleta';
import { Faces } from './pecas';
import { PortalDaProximaIlha } from './portal';

/*
 * Ilha com a mansão do sapo, no traço do rascunho (public/rascunhos/desktop.html, `.casa-svg`).
 * A mesma arte serve à tela da Ilha e à miniatura do trilho.
 */

const PEDRAS = [1, 1.9, 2.8, 3.7, 4.6, 5.5, 6.4, 7.3].map((v) => projetar([-1.6, v, 0]));
const TUFOS = [
  [-7, -6.5], [-4, -6], [2, -6.8], [6.5, -5.5], [7.2, -2], [7.3, 4.5], [4, 6.8], [1, 6], [-7, -2.5], [6, 6.5],
] as const satisfies readonly (readonly [number, number])[];

const TERRENO = (
  <>
    <Faces faces={caixa({ u: [-8, 8], v: [-8, 8], z: [-1.3, 0] }, { esquerda: MADEIRA.direita, direita: MADEIRA.esquerda, topo: GRAMA })} />
    {/* Sombra interna na beira da grama. */}
    <Faces faces={caixa({ u: [-8, 8], v: [-8, 8], z: [-0.3, 0] }, { esquerda: cor('timer-verde'), direita: cor('timer-verde-borda') })} />
    {TUFOS.map(([u, v]) => {
      const { x, y } = projetar([u, v, 0]);
      return <path key={`${u} ${v}`} d={`M${x - 12} ${y}l5-11 5 9 5-13 4 15`} fill="none" stroke={cor('timer-verde-borda')} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />;
    })}
    {PEDRAS.map(({ x, y }) => (
      <ellipse key={y} cx={x} cy={y} rx="15" ry="8" fill={PEDRA.topo} stroke={CONTORNO} strokeWidth="3" />
    ))}
  </>
);

const ARTE: Record<ParteId, Arte> = { ...ARTE_DA_CONSTRUCAO, ...ARTE_DO_EXTERIOR };

/** As partes na ordem de desenho (de trás para a frente). */
export const ORDEM_DE_DESENHO: readonly ParteId[] = [
  'torre', 'observatorio', 'arvore', 'balanco', 'sala', 'biblioteca', 'quarto', 'segundo-andar', 'sotao', 'cozinha',
  'escritorio', 'chamine', 'banheiro', 'estudio', 'piscina', 'varanda', 'horta', 'jardim', 'estufa', 'lago', 'ponte',
  'cerca', 'poste', 'caixa-correio',
];

export const VIEWBOX_DA_ILHA = '-150 -100 1300 1025';

type CasaDaIlhaProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  /** Partes já construídas; as outras aparecem tracejadas. */
  construidas: readonly ParteId[];
  /** A parte recém comprada. */
  nova?: ParteId | null;
  rotulo?: string;
  /** Toque no cais da próxima ilha. Sem ele (miniatura), o cais é só desenho. */
  onPortal?: () => void;
  /** A camada vazia, por cima das partes, onde entram os efeitos da compra. */
  efeitos?: Ref<SVGGElement>;
};

export function CasaDaIlha({ construidas, nova, onPortal, efeitos, viewBox = VIEWBOX_DA_ILHA, rotulo = 'Sua ilha', ...svg }: CasaDaIlhaProps) {
  const prontas = new Set(construidas);
  return (
    <svg {...svg} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={rotulo}>
      {TERRENO}
      {ORDEM_DE_DESENHO.map((id) => (
        <g key={id} data-parte={id} className={['parte-da-casa', prontas.has(id) ? 'feita' : '', nova === id ? 'nova' : ''].filter(Boolean).join(' ')}>
          {ARTE[id](prontas)}
        </g>
      ))}
      <PortalDaProximaIlha aberto={casaCompleta(construidas)} onToque={onPortal} />
      {efeitos ? <g ref={efeitos} pointerEvents="none" aria-hidden="true" /> : null}
    </svg>
  );
}
