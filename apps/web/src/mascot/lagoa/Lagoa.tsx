import { useId, useMemo, type CSSProperties, type ReactNode } from 'react';

import { itensVisiveis, planoDeAnimacao, type AgoraDaLagoa, type ItensVisiveis } from '@pulo/core/domain/lagoa';
import type { FrogMood, Phase, WeekSummary } from '@pulo/core/domain/types';
import { Sapo } from '@/mascot/sapo/Sapo';
import { resolverMovimento, useTheme } from '@/theme';

import { GEOMETRIA_DA_AGUA, mistura, paletaDaLagoa } from './paleta';
import './lagoa.css';

export interface LagoaProps {
  /** Fase do cenário = fase do sapo (1 a 4). */
  fase: Phase;
  /** Resumo da semana (só careDays e stable são lidos). */
  resumo: Pick<WeekSummary, 'careDays' | 'stable'>;
  agora: AgoraDaLagoa;
  estadoDoSapo?: FrogMood;
  /** Lado do quadrado do cenário, em px. Padrão 320. */
  tamanho?: number;
  reducedMotion?: boolean;
  /** Muda para o sapo pular. */
  saltoDoSapo?: number;
  className?: string;
  style?: CSSProperties;
}

type TipoDeCiclo = 'ondinha' | 'folha-esquerda' | 'folha-direita' | 'vagalume';

interface CicloProps {
  tipo: TipoDeCiclo;
  /** Duração de cada ida (ou volta), em ms. */
  dur: number;
  atraso?: number;
  ativo: boolean;
  children: ReactNode;
}

/** Elemento em loop de vai e volta (keyframes em lagoa.css). Inativo, fica no quadro inicial. */
function Ciclo({ tipo, dur, atraso = 0, ativo, children }: CicloProps) {
  return (
    <g
      className={ativo ? `lagoa-${tipo} lagoa-ativo` : `lagoa-${tipo}`}
      style={{ animationDuration: `${dur}ms`, animationDelay: `${atraso}ms` }}
    >
      {children}
    </g>
  );
}

interface GotaProps {
  x: number;
  y: number;
  atraso: number;
  ativo: boolean;
  cor: string;
}

/** Gota de chuva: cai e some, em loop (não reverte). */
function Gota({ x, y, atraso, ativo, cor }: GotaProps) {
  return (
    <g className={ativo ? 'lagoa-gota lagoa-ativo' : 'lagoa-gota'} style={{ animationDelay: `${atraso}ms` }}>
      <path d={`M${x} ${y} L${x - 2} ${y + 9}`} stroke={cor} strokeWidth={3} strokeLinecap="round" />
    </g>
  );
}

const FOLHA_ESQ = { x: 112, rx: 40, ry: 11 };
const FOLHA_DIR = { x: 188, rx: 46, ry: 13 };
const FOLHA_DIR_ESTAVEL = { x: 188, rx: 54, ry: 15 };

interface FolhaProps {
  x: number;
  y: number;
  rx: number;
  ry: number;
  agua: string;
  cor: string;
  sombra: string;
}

function Folha({ x, y, rx, ry, agua, cor, sombra }: FolhaProps) {
  return (
    <>
      <ellipse cx={x} cy={y + 3} rx={rx} ry={ry} fill={sombra} />
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={cor} />
      <polygon points={`${x},${y} ${x + rx + 6},${y - 9} ${x + rx + 6},${y + 4}`} fill={agua} />
    </>
  );
}

const VAGALUMES = [
  [70, 130], [110, 100], [220, 120], [250, 90], [180, 150], [40, 160],
] as const;

const ESTRELAS = [[120, 30], [160, 52], [200, 24], [270, 50], [30, 100]] as const;
const NUVENS = [[200, 40, 22], [224, 46, 18], [178, 48, 16]] as const;

const CAMADA: CSSProperties = { position: 'absolute', inset: 0, display: 'block' };

export function Lagoa({ fase, resumo, agora, estadoDoSapo = 'parado', tamanho = 320, reducedMotion, saltoDoSapo, className, style }: LagoaProps) {
  const tema = useTheme();
  const reduzir = reducedMotion ?? tema.reduzirMovimento;
  const ativo = reducedMotion === undefined ? tema.movimento.loops : resolverMovimento(reducedMotion).loops;
  const itens = useMemo(() => itensVisiveis(resumo, agora), [resumo, agora]);
  const plano = useMemo(() => planoDeAnimacao(itens, reduzir), [itens, reduzir]);
  const pal = paletaDaLagoa(fase, itens.noite, itens.estavel);
  const w = GEOMETRIA_DA_AGUA[fase];
  const tem = (i: ItensVisiveis['todos'][number]) => itens.todos.includes(i);
  const escala = tamanho / 300;
  const rip = mistura(pal.agua, '#FFFFFF', 0.45);
  const wcy = w.cy;
  // id do gradiente único por instância (várias lagoas na mesma página)
  const id = useId();
  const idCeu = `ceu-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // folha do sapo: a maior (direita) com semana estável; senão a menor (esquerda)
  const folhaDireita = tem('folhaVitoriaRegia') && fase >= 3;
  const folhaDir = itens.estavel ? FOLHA_DIR_ESTAVEL : FOLHA_DIR;
  const sapoNaDireita = folhaDireita && itens.estavel;
  const base: [number, number] =
    fase === 1 ? [140, wcy - 6] : fase === 2 || !sapoNaDireita ? [FOLHA_ESQ.x + 6, wcy - 14] : [folhaDir.x, wcy - 10];
  const tamSapo = tamanho * (fase >= 3 ? 0.58 : 0.6);
  const sapoEsq = base[0] * escala - tamSapo / 2;
  const sapoTopo = base[1] * escala - tamSapo * 0.9;

  const rotuloCena = `Lagoa, fase ${fase}${itens.noite ? ', noite' : ', dia'}`;
  const ondinhas = [
    [70, 86, 102, wcy + 4, 0],
    [196, 212, 228, wcy + 10, 1],
  ] as const;

  return (
    <div
      className={className}
      style={{ position: 'relative', width: tamanho, height: tamanho, overflow: 'hidden', ...style }}
      role="img"
      aria-label={rotuloCena}
      data-testid="lagoa"
    >
      <svg width={tamanho} height={tamanho} viewBox="0 0 300 300" style={CAMADA} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={idCeu} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={pal.ceuTopo} />
            <stop offset="1" stopColor={pal.ceuBase} />
          </linearGradient>
        </defs>
        <rect width={300} height={300} fill={`url(#${idCeu})`} />

        {pal.noite && (
          <g data-testid="lagoa-lua">
            <ellipse cx={60} cy={56} rx={22} ry={22} fill="#FFF4C9" />
            <ellipse cx={68} cy={50} rx={20} ry={20} fill={pal.ceuTopo} />
            {ESTRELAS.map(([x, y]) => (
              <ellipse key={x} cx={x} cy={y} rx={1.8} ry={1.8} fill="#FFFFFF" fillOpacity={0.8} />
            ))}
          </g>
        )}
        {!pal.noite && fase === 4 && <ellipse cx={236} cy={92} rx={26} ry={26} fill="#FFE29A" fillOpacity={0.85} />}

        {tem('nuvemDeChuva') && (
          <g data-testid="lagoa-nuvem">
            {NUVENS.map(([x, y, r]) => (
              <ellipse key={x} cx={x} cy={y} rx={r * 1.4} ry={r * 0.8} fill={pal.noite ? pal.nuvem : '#9FB2C8'} />
            ))}
          </g>
        )}

        {/* margem e água */}
        <ellipse cx={150} cy={wcy + 8} rx={w.rx + 12} ry={w.ry + 9} fill={pal.margem} />
        {fase === 1 && <ellipse cx={150} cy={wcy + 2} rx={w.rx - 6} ry={w.ry - 4} fill={pal.lama} />}
        <ellipse cx={150} cy={wcy} rx={w.rx - 14} ry={w.ry - 10} fill={pal.agua} />
        <ellipse cx={150} cy={wcy - 8} rx={w.rx - 40} ry={(w.ry - 10) * 0.35} fill="#FFFFFF" fillOpacity={pal.noite ? 0.05 : 0.12} />

        {/* ondinhas */}
        {ondinhas.map(([a, b, c, y, i], k) => (
          <Ciclo key={a} tipo="ondinha" ativo={ativo && k < plano.ondinhas} dur={2000} atraso={i * 700}>
            <path d={`M${a} ${y} Q${b} ${y - 8} ${c} ${y}`} stroke={rip} strokeWidth={3} strokeLinecap="round" fill="none" />
          </Ciclo>
        ))}

        {/* itens de progresso */}
        {tem('pedra') && (
          <g data-testid="item-pedra">
            <ellipse cx={52} cy={wcy - 6} rx={16} ry={9} fill={pal.noite ? '#6B6A78' : '#9A8F86'} />
            <ellipse cx={48} cy={wcy - 10} rx={10} ry={5} fill={pal.noite ? '#807F8F' : '#B3A9A0'} />
          </g>
        )}
        {tem('juncos') && (
          <g data-testid="item-juncos">
            {[246, 254, 262].map((x, k) => (
              <path key={x} d={`M${x} ${wcy - 4} L${x + (k - 1) * 4} ${wcy - 40 - k * 6}`} stroke={pal.junco} strokeWidth={4} strokeLinecap="round" />
            ))}
          </g>
        )}
        {tem('folhaVitoriaRegia') && fase >= 2 && (
          <Ciclo tipo="folha-esquerda" ativo={ativo && plano.folhas >= 1} dur={2500}>
            <g data-testid="item-folha-esquerda">
              <Folha x={FOLHA_ESQ.x} y={wcy - 8} rx={FOLHA_ESQ.rx} ry={FOLHA_ESQ.ry} agua={pal.agua} cor={pal.folha} sombra={pal.folhaSombra} />
            </g>
          </Ciclo>
        )}
        {folhaDireita && (
          <Ciclo tipo="folha-direita" ativo={ativo && plano.folhas >= 2} dur={2500} atraso={600}>
            <g data-testid="item-folha-direita">
              <Folha x={folhaDir.x} y={wcy + 4} rx={folhaDir.rx} ry={folhaDir.ry} agua={pal.agua} cor={pal.folha} sombra={pal.folhaSombra} />
              {tem('flor') && (
                <g data-testid="item-flor">
                  {[0, 1, 2, 3, 4].map((k) => {
                    const a = ((-90 + k * 72) * Math.PI) / 180;
                    const cx = folhaDir.x - 8 + 14 * Math.cos(a);
                    const cy = wcy + 4 - 12 + 9 * Math.sin(a);
                    return <ellipse key={k} cx={cx} cy={cy} rx={8} ry={5} fill="#FF8FB0" transform={`rotate(${(a * 180) / Math.PI} ${cx} ${cy})`} />;
                  })}
                  <ellipse cx={folhaDir.x - 8} cy={wcy - 8} rx={4} ry={4} fill="#FFD166" />
                </g>
              )}
            </g>
          </Ciclo>
        )}
        {tem('tronco') && (
          <g data-testid="item-tronco">
            <ellipse cx={60} cy={wcy + 18} rx={30} ry={10} fill={pal.noite ? '#5A3C2A' : '#8A5A3C'} />
            <ellipse cx={34} cy={wcy + 18} rx={7} ry={10} fill={pal.noite ? '#8A6C4C' : '#C49A6C'} />
          </g>
        )}
        {tem('aguape') && (
          <g data-testid="item-aguape">
            <ellipse cx={236} cy={wcy + 14} rx={14} ry={9} fill={pal.folha} />
            <ellipse cx={250} cy={wcy + 10} rx={10} ry={7} fill={pal.noite ? '#4FA03A' : '#6FCF4F'} />
            <ellipse cx={238} cy={wcy - 10} rx={4} ry={14} fill="#8A6FD1" />
            <ellipse cx={238} cy={wcy - 22} rx={4} ry={5} fill="#A98AE0" />
          </g>
        )}
      </svg>

      <div style={{ position: 'absolute', left: sapoEsq, top: sapoTopo, width: tamSapo, height: tamSapo, pointerEvents: 'none' }}>
        <Sapo fase={fase} estado={estadoDoSapo} tamanho={tamSapo} reducedMotion={reduzir} salto={saltoDoSapo} semSombra />
      </div>

      {/* camada do céu na frente: vagalumes e chuva */}
      <svg width={tamanho} height={tamanho} viewBox="0 0 300 300" style={{ ...CAMADA, pointerEvents: 'none' }} aria-hidden="true" focusable="false">
        {tem('vagalumes') &&
          VAGALUMES.map(([x, y], k) => (
            <Ciclo key={x} tipo="vagalume" ativo={ativo && k < plano.vagalumes} dur={2000 + (k % 3) * 500} atraso={k * 260}>
              <ellipse cx={x} cy={y} rx={9} ry={9} fill="#FFE066" fillOpacity={0.22} />
              <ellipse cx={x} cy={y} rx={4.5} ry={4.5} fill="#FFE066" />
            </Ciclo>
          ))}
        {tem('nuvemDeChuva') &&
          [190, 204, 218, 232].map((x, k) => (
            <Gota key={x} x={x} y={62} atraso={k * 250} ativo={ativo && k < plano.gotas} cor={pal.noite ? '#8FB0E8' : '#6FA3D8'} />
          ))}
      </svg>
    </div>
  );
}
