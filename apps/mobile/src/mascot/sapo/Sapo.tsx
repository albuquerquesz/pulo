import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { G } from 'react-native-svg';

import type { FrogMood, Phase } from '@pulo/core/domain/types';
import { motion } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { ROSTO_DO_ESTADO, estadoParaFase, rotuloDoSapo, type Rosto } from '../machine';
import { comPivo } from './anim';
import { BocaDoGirino, Cauda, CorpoDoGirino, OlhoDoGirino, PalpebraDoGirino, PernasDoGirino } from './girino';
import { BASE_Y, ESCALA_JOVEM, PIVOTS, VIEWBOX } from './geometria';
import * as P from './pecas';

const AG = Animated.createAnimatedComponent(G);

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
  style?: StyleProp<ViewStyle>;
}

type Fn = () => Record<string, unknown>;

/** <G> animado. `props` é um worklet que devolve as props (transform, opacity). */
function Anima({ props, testID, children }: { props: Fn; testID?: string; children: ReactNode }) {
  const animated = useAnimatedProps(props as () => object);
  return (
    <AG animatedProps={animated} testID={testID}>
      {children}
    </AG>
  );
}

const ABERTOS: Rosto['olhos'][] = ['abertos', 'olhando', 'arregalados', 'focados'];

interface CamadaProps {
  fase: Phase;
  estado: FrogMood;
  loops: boolean;
  saltos: boolean;
  fadeMs: number;
  tamanho: number;
  saltoKey: number;
  saindo?: boolean;
  semSombra?: boolean;
}

function Camada({ fase, estado, loops, saltos, fadeMs, tamanho, saltoKey, saindo, semSombra }: CamadaProps) {
  const rosto = ROSTO_DO_ESTADO[estado];
  const girino = fase <= 2;
  const abertos = ABERTOS.includes(rosto.olhos);

  const respira = useSharedValue(0);
  const piscar = useSharedValue(0);
  const pulso = useSharedValue(0);
  const rabo = useSharedValue(0);
  const impacto = useSharedValue(0);
  const opac = useSharedValue(saindo ? 1 : 1);
  const pulo = useSharedValue(0);
  const sqx = useSharedValue(1);
  const sqy = useSharedValue(1);

  // loops ambiente: respirar (3,4 s), pulso dos extras, rabo do girino
  useEffect(() => {
    if (!loops || saindo) {
      [respira, pulso, rabo].forEach((v) => {
        cancelAnimation(v);
        v.value = 0;
      });
      return;
    }
    respira.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }), -1, true);
    pulso.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true);
    rabo.value = withRepeat(withTiming(1, { duration: 520, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => [respira, pulso, rabo].forEach(cancelAnimation);
  }, [loops, saindo, respira, pulso, rabo]);

  // piscar a cada 3 a 6 s (intervalo sorteado); a animação em si roda na thread de UI
  useEffect(() => {
    if (!loops || saindo || !abertos) return;
    let vivo = true;
    let t: ReturnType<typeof setTimeout>;
    const agendar = () => {
      t = setTimeout(() => {
        if (!vivo) return;
        piscar.value = withSequence(withTiming(1, { duration: 70 }), withTiming(0, { duration: 110 }));
        agendar();
      }, 3000 + Math.random() * 3000);
    };
    agendar();
    return () => {
      vivo = false;
      clearTimeout(t);
      cancelAnimation(piscar);
      piscar.value = 0;
    };
  }, [loops, saindo, abertos, piscar]);

  // entrada do estado: desvanecimento (reduzir movimento), pouso e pulinho do feliz
  const primeira = useRef(true);
  useEffect(() => {
    const inicio = primeira.current;
    primeira.current = false;
    if (saindo) {
      opac.value = withTiming(0, { duration: fadeMs });
      return;
    }
    if (!saltos) {
      impacto.value = estado === 'pouso' ? 1 : 0;
      if (!inicio && fadeMs > 0) {
        opac.value = 0;
        opac.value = withTiming(1, { duration: fadeMs });
      }
      return;
    }
    if (estado === 'pouso' && !inicio) {
      const alto = -tamanho * 0.18;
      pulo.value = withSequence(
        withTiming(alto, { duration: 220, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) }),
      );
      const sq = motion.landingSquash;
      sqx.value = withDelay(400, withSequence(withTiming(sq.x, { duration: sq.durationMs }), withSpring(1, motion.spring)));
      sqy.value = withDelay(400, withSequence(withTiming(sq.y, { duration: sq.durationMs }), withSpring(1, motion.spring)));
      impacto.value = withDelay(400, withSequence(withTiming(1, { duration: 80 }), withDelay(520, withTiming(0, { duration: 300 }))));
    } else if (estado === 'pouso') {
      impacto.value = 1;
    } else if (!inicio) {
      // troca de estado: um "pop" curto
      sqx.value = withSequence(withTiming(1.05, { duration: 90 }), withSpring(1, motion.spring));
      sqy.value = withSequence(withTiming(0.96, { duration: 90 }), withSpring(1, motion.spring));
      if (estado === 'feliz') {
        pulo.value = withSequence(withTiming(-tamanho * 0.07, { duration: 150, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  // pulinho pedido de fora (ex.: hábito marcado)
  const primeiroSalto = useRef(true);
  useEffect(() => {
    if (primeiroSalto.current) {
      primeiroSalto.current = false;
      return;
    }
    if (!saltos || saindo) return;
    pulo.value = withSequence(
      withTiming(-tamanho * 0.12, { duration: 160, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) }),
    );
    sqy.value = withDelay(310, withSequence(withTiming(0.9, { duration: 70 }), withSpring(1, motion.spring)));
    sqx.value = withDelay(310, withSequence(withTiming(1.08, { duration: 70 }), withSpring(1, motion.spring)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saltoKey]);

  const estiloExterno = useAnimatedStyle(() => ({
    opacity: opac.value,
    transform: [{ translateY: pulo.value }, { scaleX: sqx.value }, { scaleY: sqy.value }],
  }));

  const [px, py] = PIVOTS.sapo;
  const escala = fase === 3 ? ESCALA_JOVEM : 1;
  const grupoEscala = `translate(${px} ${py}) scale(${escala}) translate(${-px} ${-py})`;

  const respirar: Fn = () => {
    'worklet';
    const b = respira.value;
    return { transform: comPivo(px, py, 1.01 - 0.03 * b, 0.98 + 0.06 * b) };
  };
  const respirarGirino: Fn = () => {
    'worklet';
    const b = respira.value;
    return { transform: comPivo(150, BASE_Y, 1.01 - 0.02 * b, 0.99 + 0.04 * b) };
  };
  const palpebra = (cx: number, cy: number): Fn => () => {
    'worklet';
    return { transform: comPivo(cx, cy, 1, piscar.value) };
  };
  const extra = (dy: number): Fn => () => {
    'worklet';
    return { opacity: 0.55 + 0.45 * pulso.value, transform: [{ translateY: dy * pulso.value }] };
  };
  const brilhando: Fn = () => {
    'worklet';
    const p = pulso.value;
    return { opacity: 0.45 + 0.55 * p, transform: comPivo(150, 60, 0.9 + 0.2 * p, 0.9 + 0.2 * p) };
  };
  const gotejar: Fn = () => {
    'worklet';
    return { transform: [{ translateY: 8 * pulso.value }] };
  };
  const impactoFn: Fn = () => {
    'worklet';
    return { opacity: impacto.value };
  };
  const caudaFn: Fn = () => {
    'worklet';
    return { transform: comPivo(180, 232, 1, 1, 0, 0, -9 + 18 * rabo.value) };
  };

  const extras = (
    <>
      {rosto.extras.includes('suor') && (
        <Anima props={gotejar}>
          <P.Suor />
        </Anima>
      )}
      {rosto.extras.includes('balao') && (
        <Anima props={extra(-4)}>
          <P.Balao />
        </Anima>
      )}
      {rosto.extras.includes('zzz') && (
        <Anima props={extra(-6)}>
          <P.Zzz />
        </Anima>
      )}
      {rosto.extras.includes('brilhos') && (
        <Anima props={brilhando}>
          <P.Brilhos />
        </Anima>
      )}
      {rosto.extras.includes('impacto') && (
        <Anima props={impactoFn}>
          <P.Impacto />
        </Anima>
      )}
    </>
  );

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: '50% 90%' }, estiloExterno]} pointerEvents="none">
      <Svg width={tamanho} height={tamanho} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} style={styles.svg}>
        {!semSombra && <P.SombraNoChao />}
        <G transform={grupoEscala}>
          {girino ? (
            <>
              <Anima props={caudaFn}>
                <Cauda />
              </Anima>
              <Anima props={respirarGirino}>
                <CorpoDoGirino />
                {fase === 2 && <PernasDoGirino />}
                <OlhoDoGirino tipo={rosto.olhos} />
                {abertos && (
                  <Anima props={palpebra(131, 211)}>
                    <PalpebraDoGirino />
                  </Anima>
                )}
                <BocaDoGirino tipo={rosto.boca} />
              </Anima>
              <G transform="translate(-49 95)">{rosto.extras.includes('suor') && <P.Suor />}</G>
              <G transform="translate(30 130) scale(0.8)">{rosto.extras.includes('brilhos') && <P.Brilhos />}</G>
            </>
          ) : (
            <>
              <Anima props={respirar}>
                <P.Corpo />
                <P.Barriga />
              </Anima>
              <P.Coxa lado={-1} />
              <P.Coxa lado={1} />
              <P.Pe lado={-1} />
              <P.Pe lado={1} />
              <Anima props={respirar}>
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
                    <Anima props={palpebra(...(PIVOTS.palpebraEsquerda as [number, number]))}>
                      <P.Palpebra lado={-1} />
                    </Anima>
                    <Anima props={palpebra(...(PIVOTS.palpebraDireita as [number, number]))}>
                      <P.Palpebra lado={1} />
                    </Anima>
                  </>
                )}
                <P.Boca tipo={rosto.boca} />
              </Anima>
              {extras}
            </>
          )}
        </G>
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  svg: { overflow: 'visible' },
});

/** Mantém a camada anterior por `ms` para o desvanecimento de troca de estado (reduzir movimento). */
function useEstadoAnterior(estado: FrogMood, fase: Phase, ativo: boolean, ms: number) {
  const ultimo = useRef<{ estado: FrogMood; fase: Phase }>({ estado, fase });
  const [anterior, setAnterior] = useState<{ estado: FrogMood; fase: Phase } | null>(null);
  useEffect(() => {
    const antes = ultimo.current;
    ultimo.current = { estado, fase };
    if (!ativo || (antes.estado === estado && antes.fase === fase)) return;
    setAnterior(antes);
    const t = setTimeout(() => setAnterior(null), ms + 20);
    return () => clearTimeout(t);
  }, [estado, fase, ativo, ms]);
  return anterior;
}

/**
 * O sapo. Estados: parado, feliz, cansado, pensando, surpreso, focado, dormindo, pouso.
 * Nas fases 1 e 2 só há arte para parado, feliz e cansado; os demais caem para parado.
 */
export function Sapo({ fase, estado = 'parado', tamanho = 220, reducedMotion, salto = 0, semSombra, style }: SapoProps) {
  const tema = useTheme();
  const reduzir = reducedMotion ?? tema.reduzirMovimento;
  const efetivo = estadoParaFase(fase, estado);
  const fadeMs = motion.reducedFade;
  const anterior = useEstadoAnterior(efetivo, fase, reduzir, fadeMs);

  return (
    <View
      style={[{ width: tamanho, height: tamanho }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={rotuloDoSapo(efetivo)}
      accessibilityLiveRegion="polite"
      testID="sapo"
    >
      {anterior && (
        <Camada
          key={`saindo-${anterior.fase}-${anterior.estado}`}
          fase={anterior.fase}
          estado={anterior.estado}
          loops={false}
          saltos={false}
          fadeMs={fadeMs}
          tamanho={tamanho}
          saltoKey={0}
          saindo
          semSombra={semSombra}
        />
      )}
      <Camada
        fase={fase}
        estado={efetivo}
        loops={!reduzir}
        saltos={!reduzir}
        fadeMs={reduzir ? fadeMs : 0}
        tamanho={tamanho}
        saltoKey={salto}
        semSombra={semSombra}
      />
    </View>
  );
}
