import type { ReactNode } from 'react';

import type { ParteId } from '@pulo/core/domain/casa';

/*
 * Ilha com a casa, portada do rascunho (public/rascunhos/desktop.html, `.casa-svg`).
 * A mesma arte serve à miniatura do trilho e à tela da Ilha (spec 24).
 */

const TERRENO = (
  <>
    <polygon points="101.6,480.0 500.0,710.0 500.0,769.8 101.6,539.8" fill="#C98B5E" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
    <polygon points="898.4,480.0 500.0,710.0 500.0,769.8 898.4,539.8" fill="#B07A4E" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
    <polygon points="500.0,250.0 898.4,480.0 500.0,710.0 101.6,480.0" fill="#A8D86E" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
    <ellipse cx="384.5" cy="473.1" rx="14" ry="7" fill="#D9D3C2" stroke="#3B2A2F" strokeWidth="3"/>
    <ellipse cx="344.6" cy="496.1" rx="14" ry="7" fill="#D9D3C2" stroke="#3B2A2F" strokeWidth="3"/>
    <ellipse cx="304.8" cy="519.1" rx="14" ry="7" fill="#D9D3C2" stroke="#3B2A2F" strokeWidth="3"/>
    <ellipse cx="265.0" cy="542.1" rx="14" ry="7" fill="#D9D3C2" stroke="#3B2A2F" strokeWidth="3"/>
  </>
);

/** As partes na ordem de desenho (de trás para a frente). */
const ORDEM: readonly ParteId[] = ['arvore', 'quarto', 'cozinha', 'varanda', 'jardim', 'cerca'];

const ARTE: Record<ParteId, ReactNode> = {
  arvore: (
    <>
      <g transform="translate(766.9,477.7)">
        <ellipse rx="34" ry="12" fill="rgba(59,42,47,.18)"/>
        <path d="M-8 0v-70h16v70z" fill="#8B5A2B" stroke="#3B2A2F" strokeWidth="4"/>
        <circle cx="0" cy="-100" r="52" fill="#6FCB55" stroke="#3B2A2F" strokeWidth="4"/>
        <circle cx="-34" cy="-74" r="30" fill="#5DBB46" stroke="#3B2A2F" strokeWidth="4"/>
        <circle cx="34" cy="-74" r="30" fill="#5DBB46" stroke="#3B2A2F" strokeWidth="4"/>
      </g>
    </>
  ),
  quarto: (
    <>
      <polygon points="380.5,411.0 500.0,480.0 500.0,360.4 380.5,291.4" fill="#EADBB4" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="619.5,411.0 500.0,480.0 500.0,360.4 619.5,291.4" fill="#F7E6C8" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="500.0,210.9 639.4,291.4 569.7,267.2 430.3,186.8" fill="#D9A04A" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="619.5,291.4 500.0,360.4 559.8,261.5" fill="#F2D79A" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="430.3,186.8 569.7,267.2 500.0,371.9 360.6,291.4" fill="#E9B85A" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="420.3,434.0 452.2,452.4 452.2,383.4 420.3,365.0" fill="#4FA3C9" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="579.7,388.0 539.8,411.0 539.8,369.6 579.7,346.6" fill="#BFEFFF" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="464.1,408.7 492.0,424.8 492.0,392.6 464.1,376.5" fill="#BFEFFF" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
    </>
  ),
  cozinha: (
    <>
      <polygon points="515.9,470.8 619.5,530.6 619.5,429.4 515.9,369.6" fill="#EADBB4" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="707.2,480.0 619.5,530.6 619.5,429.4 707.2,378.8" fill="#F7E6C8" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="603.6,307.5 727.1,378.8 673.3,359.2 549.8,287.9" fill="#D9A04A" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="707.2,378.8 619.5,429.4 663.3,353.5" fill="#F2D79A" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="549.8,287.9 673.3,359.2 619.5,440.9 496.0,369.6" fill="#E9B85A" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="683.3,447.8 643.4,470.8 643.4,434.0 683.3,411.0" fill="#BFEFFF" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="547.8,443.2 583.7,463.9 583.7,427.1 547.8,406.4" fill="#BFEFFF" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
    </>
  ),
  varanda: (
    <>
      <polygon points="284.9,429.4 340.7,461.6 340.7,447.8 284.9,415.6" fill="#B07A4E" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="404.4,424.8 340.7,461.6 340.7,447.8 404.4,411.0" fill="#C98B5E" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="348.6,378.8 404.4,411.0 340.7,447.8 284.9,415.6" fill="#D9A46E" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="284.9,429.4 290.9,432.9 290.9,359.2 284.9,355.8" fill="#B07A4E" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="296.8,429.4 290.9,432.9 290.9,359.2 296.8,355.8" fill="#C98B5E" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="290.9,352.4 296.8,355.8 290.9,359.2 284.9,355.8" fill="#C98B5E" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="334.7,458.1 340.7,461.6 340.7,388.0 334.7,384.5" fill="#B07A4E" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="346.6,458.1 340.7,461.6 340.7,388.0 346.6,384.5" fill="#C98B5E" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="340.7,381.1 346.6,384.5 340.7,388.0 334.7,384.5" fill="#C98B5E" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
    </>
  ),
  jardim: (
    <>
      <g transform="translate(508.0,549.0)">
        <path d="M0 0v-16" stroke="#3F8F23" strokeWidth="3"/>
        <circle cy="-18" r="7" fill="#FF9DB4" stroke="#3B2A2F" strokeWidth="3"/>
      </g>
      <g transform="translate(519.9,578.9)">
        <path d="M0 0v-16" stroke="#3F8F23" strokeWidth="3"/>
        <circle cy="-18" r="7" fill="#FFD166" stroke="#3B2A2F" strokeWidth="3"/>
      </g>
      <g transform="translate(567.7,588.1)">
        <path d="M0 0v-16" stroke="#3F8F23" strokeWidth="3"/>
        <circle cy="-18" r="7" fill="#B583FF" stroke="#3B2A2F" strokeWidth="3"/>
      </g>
      <g transform="translate(468.1,590.4)">
        <path d="M0 0v-16" stroke="#3F8F23" strokeWidth="3"/>
        <circle cy="-18" r="7" fill="#FF9DB4" stroke="#3B2A2F" strokeWidth="3"/>
      </g>
      <g transform="translate(512.0,611.1)">
        <path d="M0 0v-16" stroke="#3F8F23" strokeWidth="3"/>
        <circle cy="-18" r="7" fill="#FFD166" stroke="#3B2A2F" strokeWidth="3"/>
      </g>
      <g transform="translate(555.8,622.6)">
        <path d="M0 0v-16" stroke="#3F8F23" strokeWidth="3"/>
        <circle cy="-18" r="7" fill="#FF8FC7" stroke="#3B2A2F" strokeWidth="3"/>
      </g>
    </>
  ),
  cerca: (
    <>
      <polygon points="144.7,482.8 149.4,485.5 149.4,448.7 144.7,446.0" fill="#EADBB4" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="154.2,482.8 149.4,485.5 149.4,448.7 154.2,446.0" fill="#F7E6C8" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="149.4,443.2 154.2,446.0 149.4,448.7 144.7,446.0" fill="#fff" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="180.5,503.5 185.3,506.2 185.3,469.4 180.5,466.7" fill="#EADBB4" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="190.1,503.5 185.3,506.2 185.3,469.4 190.1,466.7" fill="#F7E6C8" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="185.3,463.9 190.1,466.7 185.3,469.4 180.5,466.7" fill="#fff" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="216.4,524.2 221.1,526.9 221.1,490.1 216.4,487.4" fill="#EADBB4" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="225.9,524.2 221.1,526.9 221.1,490.1 225.9,487.4" fill="#F7E6C8" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="221.1,484.6 225.9,487.4 221.1,490.1 216.4,487.4" fill="#fff" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="252.2,544.9 257.0,547.6 257.0,510.8 252.2,508.1" fill="#EADBB4" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="261.8,544.9 257.0,547.6 257.0,510.8 261.8,508.1" fill="#F7E6C8" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="257.0,505.3 261.8,508.1 257.0,510.8 252.2,508.1" fill="#fff" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="288.1,565.6 292.8,568.3 292.8,531.5 288.1,528.8" fill="#EADBB4" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="297.6,565.6 292.8,568.3 292.8,531.5 297.6,528.8" fill="#F7E6C8" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="292.8,526.0 297.6,528.8 292.8,531.5 288.1,528.8" fill="#fff" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="323.9,586.3 328.7,589.0 328.7,552.2 323.9,549.5" fill="#EADBB4" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="333.5,586.3 328.7,589.0 328.7,552.2 333.5,549.5" fill="#F7E6C8" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="328.7,546.7 333.5,549.5 328.7,552.2 323.9,549.5" fill="#fff" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="359.8,607.0 364.6,609.7 364.6,572.9 359.8,570.2" fill="#EADBB4" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="369.3,607.0 364.6,609.7 364.6,572.9 369.3,570.2" fill="#F7E6C8" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="364.6,567.4 369.3,570.2 364.6,572.9 359.8,570.2" fill="#fff" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="395.6,627.7 400.4,630.4 400.4,593.6 395.6,590.9" fill="#EADBB4" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="405.2,627.7 400.4,630.4 400.4,593.6 405.2,590.9" fill="#F7E6C8" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="400.4,588.1 405.2,590.9 400.4,593.6 395.6,590.9" fill="#fff" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="431.5,648.4 436.3,651.1 436.3,614.3 431.5,611.6" fill="#EADBB4" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="441.0,648.4 436.3,651.1 436.3,614.3 441.0,611.6" fill="#F7E6C8" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="436.3,608.8 441.0,611.6 436.3,614.3 431.5,611.6" fill="#fff" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="467.3,669.1 472.1,671.8 472.1,635.0 467.3,632.3" fill="#EADBB4" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="476.9,669.1 472.1,671.8 472.1,635.0 476.9,632.3" fill="#F7E6C8" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="472.1,629.5 476.9,632.3 472.1,635.0 467.3,632.3" fill="#fff" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
      <polygon points="144.7,457.5 503.2,664.5 503.2,657.6 144.7,450.6" fill="#fff" stroke="#3B2A2F" strokeWidth="4" strokeLinejoin="round"/>
    </>
  ),
};

type CasaDaIlhaProps = {
  /** Partes já construídas; as outras aparecem tracejadas. */
  construidas: readonly ParteId[];
  viewBox?: string;
  rotulo?: string;
  className?: string;
};

export function CasaDaIlha({ construidas, viewBox = '60 60 880 860', rotulo = 'Sua ilha', className }: CasaDaIlhaProps) {
  return (
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={rotulo} className={className}>
      {TERRENO}
      {ORDEM.map((id) => (
        <g key={id} data-parte={id} className={construidas.includes(id) ? 'parte-da-casa feita' : 'parte-da-casa'}>
          {ARTE[id]}
        </g>
      ))}
    </svg>
  );
}
