import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import type { FrogMood, Phase } from '@pulo/core/domain/types';
import { resolverMovimento, useTheme, type MovimentoResolvido } from '@/theme';

import { ROSTO_DO_ESTADO, rotuloDoSapo, type Rosto } from '../machine';
import { CURVA, esperar, ir, molaAte, paraQuadros, tocar, trilha, type Formato, type Quadros } from './anim';
import { ESCALA_JOVEM, PIVOTS, VIEWBOX } from './geometria';
import * as P from './pecas';
import './sapo.css';

export interface SapoProps {
  fase: Phase;
  estado?: FrogMood;
  /** Lado do quadrado, em px (o viewBox é 300 por 300). Padrão 220. */
  tamanho?: number;
  /** Sobrepõe o tema. Padrão: reduzir movimento do sistema ou do Perfil. */
  reducedMotion?: boolean;
  /** Mude este número para o sapo dar um pulinho (ex.: ao marcar um hábito). */
  salto?: number;
  /** Esconde a sombra de contato (a lagoa desenha a sua). */
  semSombra?: boolean;
  className?: string;
  style?: CSSProperties;
}

type Pivo = readonly [number, number];

/** transform-origin em unidades do viewBox. */
const origem = ([x, y]: Pivo): CSSProperties => ({ transformOrigin: `${x}px ${y}px` });

const ABERTOS: readonly Rosto['olhos'][] = ['abertos', 'olhando', 'arregalados', 'focados'];

type Canal = 'pulo' | 'squash' | 'opacidade' | 'impacto';
type Canais = Record<Canal, Animation | null>;

/** Toca no canal, cancelando o que estava tocando nele. */
function animar(canais: Canais, canal: Canal, el: Element | null, quadros: Quadros, manter = false) {
  canais[canal] = tocar(el, canais[canal], quadros, manter);
}

const deslocarY: Formato = (v) => ({ transform: `translateY(${v}px)` });
const opacidade: Formato = (v) => ({ opacity: v });
/** `p` vai de 0 (repouso) a 1 (achatado em sx por sy). */
const achatar =
  (sx: number, sy: number): Formato =>
  (p) => ({ transform: `scale(${1 + (sx - 1) * p}, ${1 + (sy - 1) * p})` });

interface CamadaProps {
  fase: Phase;
  estado: FrogMood;
  movimento: MovimentoResolvido;
  tamanho: number;
  saltoKey: number;
  saindo?: boolean;
  semSombra?: boolean;
}

function Camada({ fase, estado, movimento, tamanho, saltoKey, saindo = false, semSombra }: CamadaProps) {
  const rosto = ROSTO_DO_ESTADO[estado];
  const abertos = ABERTOS.includes(rosto.olhos);
  const loops = movimento.loops && !saindo;
  const { saltos, fadeDeEstado: fadeMs, spring: mola, landingSquash: sq } = movimento;

  // pulo e opacidade na camada de fora; squash na de dentro (pivô em 50% 90%)
  const puloRef = useRef<HTMLDivElement>(null);
  const squashRef = useRef<HTMLDivElement>(null);
  const impactoRef = useRef<SVGGElement>(null);
  const canais = useRef<Canais>({ pulo: null, squash: null, opacidade: null, impacto: null });

  // camada que sai: desvanece (reduzir movimento)
  useLayoutEffect(() => {
    if (!saindo) return;
    animar(canais.current, 'opacidade', puloRef.current, paraQuadros(ir(trilha(1), 0, fadeMs), opacidade), true);
  }, [saindo, fadeMs]);

  // entrada do estado: desvanecimento (reduzir movimento), pouso e pulinho do feliz.
  // Efeito de layout para o primeiro quadro já sair animado (sem piscar o estado final).
  const estadoVisto = useRef(estado);
  useLayoutEffect(() => {
    if (estadoVisto.current === estado) return;
    estadoVisto.current = estado;
    if (saindo) return;
    const c = canais.current;
    if (!saltos) {
      if (fadeMs > 0) animar(c, 'opacidade', puloRef.current, paraQuadros(ir(trilha(0), 1, fadeMs), opacidade));
      return;
    }
    if (estado === 'pouso') {
      const alto = -tamanho * 0.18;
      const subida = ir(ir(trilha(0), alto, 220, CURVA.saidaQuad), 0, 180, CURVA.entradaQuad);
      animar(c, 'pulo', puloRef.current, paraQuadros(subida, deslocarY));
      const achata = molaAte(ir(esperar(trilha(0), 400), 1, sq.durationMs), 0, mola);
      animar(c, 'squash', squashRef.current, paraQuadros(achata, achatar(sq.x, sq.y)));
      const poeira = ir(esperar(ir(esperar(trilha(0), 400), 1, 80), 520), 0, 300);
      animar(c, 'impacto', impactoRef.current, paraQuadros(poeira, opacidade), true);
      return;
    }
    // troca de estado: um "pop" curto
    animar(c, 'squash', squashRef.current, paraQuadros(molaAte(ir(trilha(0), 1, 90), 0, mola), achatar(1.05, 0.96)));
    if (estado !== 'feliz') return;
    const pulinho = ir(ir(trilha(0), -tamanho * 0.07, 150, CURVA.saidaQuad), 0, 150, CURVA.entradaQuad);
    animar(c, 'pulo', puloRef.current, paraQuadros(pulinho, deslocarY));
  }, [estado, saindo, saltos, fadeMs, tamanho, mola, sq]);

  // pulinho pedido de fora (ex.: hábito marcado)
  const saltoVisto = useRef(saltoKey);
  useEffect(() => {
    if (saltoVisto.current === saltoKey) return;
    saltoVisto.current = saltoKey;
    if (!saltos || saindo) return;
    const c = canais.current;
    const pulinho = ir(ir(trilha(0), -tamanho * 0.12, 160, CURVA.saidaQuad), 0, 150, CURVA.entradaQuad);
    animar(c, 'pulo', puloRef.current, paraQuadros(pulinho, deslocarY));
    const achata = molaAte(ir(esperar(trilha(0), 310), 1, 70), 0, mola);
    animar(c, 'squash', squashRef.current, paraQuadros(achata, achatar(1.08, 0.9)));
  }, [saltoKey, saltos, saindo, tamanho, mola]);

  const [px, py] = PIVOTS.sapo;
  const escala = fase < 4 ? ESCALA_JOVEM : 1;
  const grupoEscala = `translate(${px} ${py}) scale(${escala}) translate(${-px} ${-py})`;

  const extras = (
    <>
      {rosto.extras.includes('suor') && (
        <g className="sapo-gotejar">
          <P.Suor />
        </g>
      )}
      {rosto.extras.includes('balao') && (
        <g className="sapo-balao">
          <P.Balao />
        </g>
      )}
      {rosto.extras.includes('zzz') && (
        <g className="sapo-zzz">
          <P.Zzz />
        </g>
      )}
      {rosto.extras.includes('brilhos') && (
        <g className="sapo-brilha" style={origem(PIVOTS.brilhos)}>
          <P.Brilhos />
        </g>
      )}
      {rosto.extras.includes('impacto') && (
        <g ref={impactoRef}>
          <P.Impacto />
        </g>
      )}
    </>
  );

  return (
    <div ref={puloRef} className="sapo-camada">
      <div ref={squashRef} className="sapo-camada">
        <svg
          width={tamanho}
          height={tamanho}
          viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
          className={loops ? 'sapo-svg sapo-vivo' : 'sapo-svg'}
          aria-hidden="true"
          focusable="false"
        >
          {!semSombra && <P.SombraNoChao />}
          <g transform={grupoEscala}>
            <>
                <g className="sapo-respira" style={origem(PIVOTS.sapo)}>
                  <P.Corpo />
                  <P.Barriga />
                </g>
                <P.Coxa lado={-1} />
                <P.Coxa lado={1} />
                <P.Pe lado={-1} />
                <P.Pe lado={1} />
                <g className="sapo-respira" style={origem(PIVOTS.sapo)}>
                  <P.Braco lado={-1} />
                  <P.Braco lado={1} />
                  <P.Mao lado={-1} />
                  <P.Mao lado={1} />
                  <P.Cabeca />
                  <P.Bochecha lado={-1} />
                  <P.Bochecha lado={1} />
                  <P.BulboDoOlho lado={-1} />
                  <P.BulboDoOlho lado={1} />
                  <P.Olho lado={-1} tipo={rosto.olhos} />
                  <P.Olho lado={1} tipo={rosto.olhos} />
                  {abertos && (
                    <>
                      <g className="sapo-palpebra" style={origem(PIVOTS.palpebraEsquerda)}>
                        <P.Palpebra lado={-1} />
                      </g>
                      <g className="sapo-palpebra" style={origem(PIVOTS.palpebraDireita)}>
                        <P.Palpebra lado={1} />
                      </g>
                    </>
                  )}
                  <P.Boca tipo={rosto.boca} />
                </g>
                {extras}
              </>
          </g>
        </svg>
      </div>
    </div>
  );
}

interface Retrato {
  estado: FrogMood;
  fase: Phase;
}

/** Mantém a camada anterior por `ms` para o desvanecimento de troca de estado (reduzir movimento). */
function useEstadoAnterior(estado: FrogMood, fase: Phase, ativo: boolean, ms: number) {
  const [ultimo, setUltimo] = useState<Retrato>({ estado, fase });
  const [anterior, setAnterior] = useState<Retrato | null>(null);
  // estado derivado das props, ajustado durante o render (padrão do React para "valor anterior")
  if (ultimo.estado !== estado || ultimo.fase !== fase) {
    setUltimo({ estado, fase });
    setAnterior(ativo ? ultimo : null);
  }
  useEffect(() => {
    if (!anterior) return;
    const t = setTimeout(() => setAnterior(null), ms + 20);
    return () => clearTimeout(t);
  }, [anterior, ms]);
  return anterior;
}

/**
 * O sapo. Estados: parado, feliz, cansado, pensando, surpreso, focado, dormindo, pouso.
 * Fases 1 a 3 desenham o sapo jovem; a fase 4, o adulto.
 */
export function Sapo({ fase, estado = 'parado', tamanho = 220, reducedMotion, salto = 0, semSombra, className, style }: SapoProps) {
  const tema = useTheme();
  const movimento = useMemo(
    () => (reducedMotion === undefined ? tema.movimento : resolverMovimento(reducedMotion)),
    [reducedMotion, tema.movimento],
  );
  const anterior = useEstadoAnterior(estado, fase, !movimento.saltos, movimento.fadeDeEstado);

  return (
    <div
      className={className}
      style={{ position: 'relative', width: tamanho, height: tamanho, ...style }}
      role="img"
      aria-label={rotuloDoSapo(estado)}
      aria-live="polite"
      data-testid="sapo"
    >
      {anterior && (
        <Camada
          key={`saindo-${anterior.fase}-${anterior.estado}`}
          fase={anterior.fase}
          estado={anterior.estado}
          movimento={movimento}
          tamanho={tamanho}
          saltoKey={0}
          saindo
          semSombra={semSombra}
        />
      )}
      <Camada fase={fase} estado={estado} movimento={movimento} tamanho={tamanho} saltoKey={salto} semSombra={semSombra} />
    </div>
  );
}
