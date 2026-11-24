import type { KeyboardEvent, ReactNode } from 'react';

import type { AreaId, AreaNoMapa, EnfeiteId } from '@pulo/core/domain/ilha';
import type { Phase } from '@pulo/core/domain/types';
import { Sapo } from '@/mascot/sapo/Sapo';

/** Meia largura, meia altura e espessura de cada ilhota (projeção isométrica 2:1). */
const A = 92;
const B = 46;
const D = 26;
/** Recorte do desenho (o mapa ocupa só esta caixa). */
const VX = 60;
const VY = 8;
const LARGURA = 530;
const ALTURA = 536;

/** Centro do topo de cada área no mapa, em zigue zague da lagoa (embaixo) até o farol (em cima). */
const POSICAO: Record<AreaId, readonly [number, number]> = {
  lagoa: [170, 440],
  praia: [430, 400],
  bosque: [240, 292],
  cachoeira: [480, 232],
  farol: [300, 112],
};

/** Cores do chão: topo, face esquerda e face direita. */
const CHAO: Record<AreaId, readonly [string, string, string]> = {
  lagoa: ['#8FD06A', '#6FAE4E', '#5E9A40'],
  praia: ['#F3DB9A', '#D9BC74', '#C7A964'],
  bosque: ['#6CBF5A', '#4F9A44', '#43853A'],
  cachoeira: ['#7CC4A0', '#5AA27F', '#4C8E6E'],
  farol: ['#A9D18E', '#87B06C', '#779C5E'],
};

const AGUA = '#4FD1B5';
const MADEIRA = '#9A6B43';

const pts = (lista: readonly (readonly [number, number])[]) => lista.map(([x, y]) => `${x},${y}`).join(' ');

function Arvore({ x, y, h = 30 }: { x: number; y: number; h?: number }) {
  return (
    <g>
      <rect x={x - 2.5} y={y - 8} width={5} height={10} rx={1.5} fill={MADEIRA} />
      <polygon points={pts([[x, y - 8 - h], [x + h * 0.42, y - 6], [x - h * 0.42, y - 6]])} fill="#3E9E5E" />
      <polygon points={pts([[x, y - 8 - h], [x + h * 0.42, y - 6], [x, y - 6]])} fill="#2F8A4D" />
    </g>
  );
}

/** O que cada área já tem quando abre. */
function Cenario({ id, x, y }: { id: AreaId; x: number; y: number }): ReactNode {
  switch (id) {
    case 'lagoa':
      return (
        <g>
          <ellipse cx={x - 18} cy={y + 2} rx={40} ry={17} fill={AGUA} />
          <ellipse cx={x - 30} cy={y} rx={9} ry={4} fill="#5EC47A" />
          <Arvore x={x + 48} y={y - 14} h={24} />
        </g>
      );
    case 'praia':
      return (
        <g>
          <polygon points={pts([[x + A, y], [x, y + B], [x - 20, y + B - 10], [x + A - 26, y - 4]])} fill="#6CCFE0" />
          <path d={`M${x - 40} ${y + 4} Q ${x - 44} ${y - 30} ${x - 30} ${y - 46}`} stroke={MADEIRA} strokeWidth={4} fill="none" strokeLinecap="round" />
          <path d={`M${x - 30} ${y - 46} q -18 -2 -26 8 M${x - 30} ${y - 46} q 16 -6 24 4 M${x - 30} ${y - 46} q -4 -14 6 -18`} stroke="#3E9E5E" strokeWidth={5} fill="none" strokeLinecap="round" />
        </g>
      );
    case 'bosque':
      return (
        <g>
          <Arvore x={x - 44} y={y - 4} h={34} />
          <Arvore x={x - 10} y={y - 18} h={40} />
          <Arvore x={x + 26} y={y + 4} h={30} />
        </g>
      );
    case 'cachoeira':
      return (
        <g>
          <polygon points={pts([[x - 50, y - 6], [x - 6, y - 28], [x - 6, y - 62], [x - 50, y - 40]])} fill="#8C9A92" />
          <polygon points={pts([[x - 34, y - 12], [x - 20, y - 19], [x - 20, y - 52], [x - 34, y - 45]])} fill="#9EE3F0" />
          <ellipse cx={x - 22} cy={y + 2} rx={30} ry={12} fill={AGUA} />
        </g>
      );
    case 'farol':
      return (
        <g>
          <polygon points={pts([[x - 14, y], [x + 14, y], [x + 9, y - 70], [x - 9, y - 70]])} fill="#FFFFFF" />
          <polygon points={pts([[x - 12, y - 18], [x + 12, y - 18], [x + 11, y - 30], [x - 11, y - 30]])} fill="#FF7A59" />
          <polygon points={pts([[x - 10, y - 46], [x + 10, y - 46], [x + 9.5, y - 56], [x - 9.5, y - 56]])} fill="#FF7A59" />
          <rect x={x - 11} y={y - 82} width={22} height={12} rx={3} fill="#FFD166" />
          <polygon points={pts([[x - 13, y - 82], [x + 13, y - 82], [x, y - 94]])} fill="#D9583A" />
        </g>
      );
  }
}

/** Enfeites comprados, cada um no seu canto da área. */
function Enfeite({ id, x, y }: { id: EnfeiteId; x: number; y: number }): ReactNode {
  switch (id) {
    case 'banco':
      return (
        <g>
          <rect x={x + 22} y={y + 8} width={26} height={6} rx={2} fill={MADEIRA} />
          <rect x={x + 24} y={y + 14} width={3} height={7} fill={MADEIRA} />
          <rect x={x + 43} y={y + 14} width={3} height={7} fill={MADEIRA} />
        </g>
      );
    case 'lanterna':
      return (
        <g>
          <rect x={x + 62} y={y - 16} width={3} height={26} fill="#4A4A4A" />
          <circle cx={x + 63.5} cy={y - 19} r={6} fill="#FFD166" />
          <circle cx={x + 63.5} cy={y - 19} r={11} fill="#FFD166" fillOpacity={0.3} />
        </g>
      );
    case 'ponte':
      return <path d={`M${x - 52} ${y + 6} Q ${x - 18} ${y - 18} ${x + 16} ${y + 6}`} stroke={MADEIRA} strokeWidth={6} fill="none" strokeLinecap="round" />;
    case 'guardaSol':
      return (
        <g>
          <rect x={x + 8} y={y - 24} width={3} height={30} fill="#7A7A7A" />
          <path d={`M${x - 12} ${y - 22} Q ${x + 9.5} ${y - 46} ${x + 31} ${y - 22} Z`} fill="#FF7A59" />
          <path d={`M${x + 2} ${y - 22} Q ${x + 9.5} ${y - 44} ${x + 17} ${y - 22} Z`} fill="#FFFFFF" />
        </g>
      );
    case 'castelo':
      return (
        <g fill="#E2C47E">
          <rect x={x - 6} y={y + 6} width={24} height={14} />
          <rect x={x - 8} y={y} width={8} height={20} />
          <rect x={x + 12} y={y} width={8} height={20} />
          <polygon points={pts([[x + 1, y + 6], [x + 6, y - 4], [x + 11, y + 6]])} />
        </g>
      );
    case 'barco':
      return (
        <g>
          <path d={`M${x + 34} ${y + 22} L ${x + 66} ${y + 22} L ${x + 60} ${y + 30} L ${x + 40} ${y + 30} Z`} fill={MADEIRA} />
          <rect x={x + 49} y={y} width={2} height={22} fill="#4A4A4A" />
          <polygon points={pts([[x + 51, y], [x + 64, y + 18], [x + 51, y + 18]])} fill="#FFFFFF" />
        </g>
      );
    case 'cogumelos':
      return (
        <g>
          {[
            [x + 44, y + 14, 7],
            [x + 56, y + 20, 5],
          ].map(([cx, cy, r]) => (
            <g key={cx}>
              <rect x={cx - 1.5} y={cy - 2} width={3} height={7} fill="#F7F3E3" />
              <path d={`M${cx - r} ${cy - 1} A ${r} ${r} 0 0 1 ${cx + r} ${cy - 1} Z`} fill="#E5484D" />
              <circle cx={cx - 2} cy={cy - 4} r={1.2} fill="#FFFFFF" />
            </g>
          ))}
        </g>
      );
    case 'balanco':
      return (
        <g stroke={MADEIRA} strokeWidth={3} strokeLinecap="round" fill="none">
          <path d={`M${x - 62} ${y + 18} L ${x - 54} ${y - 14} L ${x - 30} ${y - 14} L ${x - 22} ${y + 18}`} />
          <path d={`M${x - 46} ${y - 14} L ${x - 46} ${y + 6} M${x - 38} ${y - 14} L ${x - 38} ${y + 6}`} strokeWidth={1.5} />
          <path d={`M${x - 49} ${y + 7} L ${x - 35} ${y + 7}`} strokeWidth={4} />
        </g>
      );
    case 'casaNaArvore':
      return (
        <g>
          <rect x={x - 22} y={y - 58} width={24} height={16} rx={2} fill={MADEIRA} />
          <polygon points={pts([[x - 25, y - 58], [x + 5, y - 58], [x - 10, y - 70]])} fill="#D9583A" />
          <rect x={x - 13} y={y - 52} width={6} height={8} fill="#FFD166" />
        </g>
      );
    case 'arcoIris':
      return (
        <g fill="none" strokeWidth={4} strokeLinecap="round" opacity={0.85}>
          <path d={`M${x - 10} ${y - 8} A 36 30 0 0 1 ${x + 62} ${y - 8}`} stroke="#FF7A59" />
          <path d={`M${x - 4} ${y - 8} A 30 24 0 0 1 ${x + 56} ${y - 8}`} stroke="#FFD166" />
          <path d={`M${x + 2} ${y - 8} A 24 18 0 0 1 ${x + 50} ${y - 8}`} stroke="#8FE05A" />
          <path d={`M${x + 8} ${y - 8} A 18 12 0 0 1 ${x + 44} ${y - 8}`} stroke="#6C63B5" />
        </g>
      );
    case 'pedras':
      return (
        <g fill="#A3ADA7">
          <ellipse cx={x - 2} cy={y + 18} rx={6} ry={3} />
          <ellipse cx={x + 12} cy={y + 22} rx={6} ry={3} />
          <ellipse cx={x + 26} cy={y + 18} rx={6} ry={3} />
        </g>
      );
    case 'deck':
      return (
        <g>
          <polygon points={pts([[x + 30, y + 4], [x + 62, y - 12], [x + 76, y - 5], [x + 44, y + 11]])} fill="#B9875A" />
          <polygon points={pts([[x + 44, y + 11], [x + 76, y - 5], [x + 76, y - 1], [x + 44, y + 15]])} fill={MADEIRA} />
        </g>
      );
    case 'bandeirinhas':
      return (
        <g>
          <path d={`M${x - 62} ${y - 6} Q ${x - 34} ${y + 8} ${x - 6} ${y - 6}`} stroke="#5E6B62" strokeWidth={1.2} fill="none" />
          {[-56, -46, -36, -26, -16].map((dx, i) => (
            <polygon key={dx} points={pts([[x + dx, y - 3 + (i === 2 ? 4 : i % 2 ? 2 : 0)], [x + dx + 7, y - 3 + (i === 2 ? 4 : i % 2 ? 2 : 0)], [x + dx + 3.5, y + 6 + (i === 2 ? 4 : i % 2 ? 2 : 0)]])} fill={['#FF7A59', '#FFD166', '#8FE05A', '#6C63B5', '#3FC9A2'][i]} />
          ))}
        </g>
      );
    case 'telescopio':
      return (
        <g stroke="#4A4A4A" strokeWidth={2} strokeLinecap="round">
          <path d={`M${x + 46} ${y + 18} L ${x + 52} ${y + 4} L ${x + 58} ${y + 18} M${x + 52} ${y + 4} L ${x + 52} ${y + 18}`} fill="none" />
          <rect x={x + 42} y={y - 6} width={22} height={7} rx={3} fill="#6C63B5" stroke="none" transform={`rotate(-24 ${x + 53} ${y - 2})`} />
        </g>
      );
    case 'fogueira':
      return (
        <g>
          <path d={`M${x + 18} ${y + 24} L ${x + 40} ${y + 16} M${x + 18} ${y + 16} L ${x + 40} ${y + 24}`} stroke={MADEIRA} strokeWidth={4} strokeLinecap="round" />
          <path d={`M${x + 29} ${y + 18} C ${x + 20} ${y + 8} ${x + 28} ${y + 2} ${x + 29} ${y - 6} C ${x + 34} ${y + 2} ${x + 38} ${y + 8} ${x + 29} ${y + 18} Z`} fill="#FF7A59" />
          <path d={`M${x + 29} ${y + 18} C ${x + 25} ${y + 12} ${x + 29} ${y + 8} ${x + 29} ${y + 4} C ${x + 32} ${y + 8} ${x + 33} ${y + 12} ${x + 29} ${y + 18} Z`} fill="#FFD166" />
        </g>
      );
  }
}

function Cadeado({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x - 7} ${y - 4} v -6 a 7 7 0 0 1 14 0 v 6`} stroke="var(--pulo-muted)" strokeWidth={3} fill="none" />
      <rect x={x - 11} y={y - 5} width={22} height={17} rx={4} fill="var(--pulo-muted)" />
    </g>
  );
}

export type MapaDaIlhaProps = {
  areas: AreaNoMapa[];
  selecionada: AreaId;
  onSelecionar: (id: AreaId) => void;
  /** Fase do sapo, para o desenho dele. */
  faseDoSapo: Phase;
  /** Tamanho do sapo em px (o mapa escala com a largura; o sapo acompanha pela tela). */
  tamanhoDoSapo?: number;
};

/** Mapa da ilha em 2.5D (isométrico): uma ilhota por área, ligadas por trilha. O sapo fica na área mais alta aberta. */
export function MapaDaIlha({ areas, selecionada, onSelecionar, faseDoSapo, tamanhoDoSapo = 72 }: MapaDaIlhaProps) {
  const abertas = areas.filter((a) => a.estado === 'aberta');
  const casa = abertas[abertas.length - 1]?.id ?? 'lagoa';
  const [sx, sy] = POSICAO[casa];
  // De trás para a frente: as mais altas no mapa primeiro.
  const ordem = [...areas].sort((a, b) => POSICAO[a.id][1] - POSICAO[b.id][1]);
  const tecla = (id: AreaId) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelecionar(id);
    }
  };

  return (
    <div className="relative w-full" style={{ aspectRatio: `${LARGURA} / ${ALTURA}` }} data-testid="mapa-da-ilha">
      <svg viewBox={`${VX} ${VY} ${LARGURA} ${ALTURA}`} className="absolute inset-0 size-full" role="group" aria-label="Mapa da ilha">
        {/* Trilha entre as áreas, na ordem em que abrem. */}
        {areas.slice(1).map((a, i) => {
          const [x1, y1] = POSICAO[areas[i].id];
          const [x2, y2] = POSICAO[a.id];
          const aberta = a.estado === 'aberta';
          return (
            <path
              key={a.id}
              d={`M${x1} ${y1 + D / 2} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 + 40} ${x2} ${y2 + D / 2}`}
              stroke={aberta ? 'var(--pulo-sapo-borda)' : 'var(--pulo-line)'}
              strokeWidth={6}
              strokeDasharray="2 12"
              strokeLinecap="round"
              fill="none"
            />
          );
        })}

        {ordem.map((area) => {
          const [x, y] = POSICAO[area.id];
          const aberta = area.estado === 'aberta';
          const [topo, esq, dir] = aberta ? CHAO[area.id] : ['var(--pulo-line)', 'var(--pulo-line)', 'var(--pulo-line)'];
          const sel = area.id === selecionada;
          const topoPts: [number, number][] = [
            [x, y - B],
            [x + A, y],
            [x, y + B],
            [x - A, y],
          ];
          return (
            <g
              key={area.id}
              role="button"
              tabIndex={0}
              aria-pressed={sel}
              aria-label={`${area.nome}, ${aberta ? 'aberta' : area.estado === 'proxima' ? `abre com ${area.custo} moscas` : 'fechada'}`}
              onClick={() => onSelecionar(area.id)}
              onKeyDown={tecla(area.id)}
              className="cursor-pointer outline-none"
              data-testid={`area-${area.id}`}
            >
              <polygon points={pts([[x - A, y], [x, y + B], [x, y + B + D], [x - A, y + D]])} fill={esq} opacity={aberta ? 1 : 0.75} />
              <polygon points={pts([[x, y + B], [x + A, y], [x + A, y + D], [x, y + B + D]])} fill={dir} opacity={aberta ? 1 : 0.55} />
              <polygon
                points={pts(topoPts)}
                fill={topo}
                stroke={sel ? 'var(--pulo-sapo-borda)' : 'none'}
                strokeWidth={sel ? 5 : 0}
                strokeLinejoin="round"
              />
              {aberta ? (
                <>
                  <Cenario id={area.id} x={x} y={y} />
                  {area.enfeitesNoMapa.filter((e) => e.comprado).map((e) => (
                    <Enfeite key={e.id} id={e.id} x={x} y={y} />
                  ))}
                </>
              ) : (
                <Cadeado x={x} y={y} />
              )}
              <text x={x} y={y + B + D + 24} textAnchor="middle" fontSize={17} fontWeight={800} fill={aberta ? 'var(--pulo-ink)' : 'var(--pulo-muted)'}>
                {area.nome}
              </text>
            </g>
          );
        })}
      </svg>

      <div
        className="pointer-events-none absolute"
        style={{ left: `${((sx - VX) / LARGURA) * 100}%`, top: `${((sy - VY) / ALTURA) * 100}%`, transform: 'translate(-10%, -88%)' }}
      >
        <Sapo fase={faseDoSapo} estado="feliz" tamanho={tamanhoDoSapo} semSombra />
      </div>
    </div>
  );
}
