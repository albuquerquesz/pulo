import { useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';

import { itensVisiveis, planoDeAnimacao, type AgoraDaLagoa, type ItensVisiveis } from '@/domain/lagoa';
import type { FrogMood, Phase, WeekSummary } from '@/domain/types';
import { Sapo } from '@/mascot/sapo/Sapo';
import { useTheme } from '@/theme/useTheme';

import { GEOMETRIA_DA_AGUA, mistura, paletaDaLagoa } from './paleta';

const AG = Animated.createAnimatedComponent(G);

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
  style?: StyleProp<ViewStyle>;
}

type Fn = (t: number) => Record<string, unknown>;

/** Elemento animado em loop de `dur` ms (vai e volta). `anim` é um worklet de t (0 a 1). */
function Ciclo({ anim, dur, atraso = 0, ativo, children }: { anim: Fn; dur: number; atraso?: number; ativo: boolean; children: ReactNode }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!ativo) return;
    t.value = withDelay(atraso, withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(t);
  }, [ativo, dur, atraso, t]);
  const props = useAnimatedProps(() => anim(t.value) as object);
  return <AG animatedProps={props}>{children}</AG>;
}

/** Gota de chuva: cai e some, em loop (não reverte). */
function Gota({ x, y, atraso, ativo, cor }: { x: number; y: number; atraso: number; ativo: boolean; cor: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!ativo) return;
    t.value = withDelay(atraso, withRepeat(withTiming(1, { duration: 1000, easing: Easing.in(Easing.quad) }), -1, false));
    return () => cancelAnimation(t);
  }, [ativo, atraso, t]);
  const props = useAnimatedProps(() => ({ opacity: 1 - t.value * 0.9, transform: [{ translateY: t.value * 46 }] }));
  return (
    <AG animatedProps={props}>
      <Path d={`M${x} ${y} L${x - 2} ${y + 9}`} stroke={cor} strokeWidth={3} strokeLinecap="round" />
    </AG>
  );
}

const FOLHA_ESQ = { x: 112, rx: 40, ry: 11 };
const FOLHA_DIR = { x: 188, rx: 46, ry: 13 };
const FOLHA_DIR_ESTAVEL = { x: 188, rx: 54, ry: 15 };

function Folha({ x, y, rx, ry, agua, cor, sombra }: { x: number; y: number; rx: number; ry: number; agua: string; cor: string; sombra: string }) {
  return (
    <>
      <Ellipse cx={x} cy={y + 3} rx={rx} ry={ry} fill={sombra} />
      <Ellipse cx={x} cy={y} rx={rx} ry={ry} fill={cor} />
      <Polygon points={`${x},${y} ${x + rx + 6},${y - 9} ${x + rx + 6},${y + 4}`} fill={agua} />
    </>
  );
}

const VAGALUMES = [
  [70, 130], [110, 100], [220, 120], [250, 90], [180, 150], [40, 160],
] as const;

export function Lagoa({ fase, resumo, agora, estadoDoSapo = 'parado', tamanho = 320, reducedMotion, saltoDoSapo, style }: LagoaProps) {
  const tema = useTheme();
  const reduzir = reducedMotion ?? tema.reduzirMovimento;
  const itens: ItensVisiveis = useMemo(() => itensVisiveis(resumo, agora), [resumo, agora]);
  const plano = useMemo(() => planoDeAnimacao(itens, reduzir), [itens, reduzir]);
  const ativo = !reduzir;
  const pal = paletaDaLagoa(fase, itens.noite, itens.estavel);
  const w = GEOMETRIA_DA_AGUA[fase];
  const tem = (i: ItensVisiveis['todos'][number]) => itens.todos.includes(i);
  const escala = tamanho / 300;
  const rip = mistura(pal.agua, '#FFFFFF', 0.45);
  const wcy = w.cy;

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

  return (
    <View
      style={[{ width: tamanho, height: tamanho, overflow: 'hidden' }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={rotuloCena}
      testID="lagoa"
    >
      <Svg width={tamanho} height={tamanho} viewBox="0 0 300 300" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="ceu" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={pal.ceuTopo} />
            <Stop offset="1" stopColor={pal.ceuBase} />
          </LinearGradient>
        </Defs>
        <Rect width={300} height={300} fill="url(#ceu)" />

        {pal.noite && (
          <G testID="lagoa-lua">
            <Ellipse cx={60} cy={56} rx={22} ry={22} fill="#FFF4C9" />
            <Ellipse cx={68} cy={50} rx={20} ry={20} fill={pal.ceuTopo} />
            {[[120, 30], [160, 52], [200, 24], [270, 50], [30, 100]].map(([x, y]) => (
              <Ellipse key={x} cx={x} cy={y} rx={1.8} ry={1.8} fill="#FFFFFF" fillOpacity={0.8} />
            ))}
          </G>
        )}
        {!pal.noite && fase === 4 && <Ellipse cx={236} cy={92} rx={26} ry={26} fill="#FFE29A" fillOpacity={0.85} />}

        {tem('nuvemDeChuva') && (
          <G testID="lagoa-nuvem">
            {[[200, 40, 22], [224, 46, 18], [178, 48, 16]].map(([x, y, r]) => (
              <Ellipse key={x} cx={x} cy={y} rx={r * 1.4} ry={r * 0.8} fill={pal.noite ? pal.nuvem : '#9FB2C8'} />
            ))}
          </G>
        )}

        {/* margem e água */}
        <Ellipse cx={150} cy={wcy + 8} rx={w.rx + 12} ry={w.ry + 9} fill={pal.margem} />
        {fase === 1 && <Ellipse cx={150} cy={wcy + 2} rx={w.rx - 6} ry={w.ry - 4} fill={pal.lama} />}
        <Ellipse cx={150} cy={wcy} rx={w.rx - 14} ry={w.ry - 10} fill={pal.agua} />
        <Ellipse cx={150} cy={wcy - 8} rx={w.rx - 40} ry={(w.ry - 10) * 0.35} fill="#FFFFFF" fillOpacity={pal.noite ? 0.05 : 0.12} />

        {/* ondinhas */}
        {[
          [70, 86, 102, wcy + 4, 0],
          [196, 212, 228, wcy + 10, 1],
        ].map(([a, b, c, y, i], k) => (
            <Ciclo
              key={a}
              ativo={ativo && k < plano.ondinhas}
              dur={2000}
              atraso={(i as number) * 700}
              anim={(t) => {
                'worklet';
                return { opacity: 0.35 + 0.65 * t, transform: [{ translateX: -4 + 8 * t }] };
              }}
            >
              <Path d={`M${a} ${y} Q${b} ${(y as number) - 8} ${c} ${y}`} stroke={rip} strokeWidth={3} strokeLinecap="round" fill="none" />
            </Ciclo>
        ))}

        {/* itens de progresso */}
        {tem('pedra') && (
          <G testID="item-pedra">
            <Ellipse cx={52} cy={wcy - 6} rx={16} ry={9} fill={pal.noite ? '#6B6A78' : '#9A8F86'} />
            <Ellipse cx={48} cy={wcy - 10} rx={10} ry={5} fill={pal.noite ? '#807F8F' : '#B3A9A0'} />
          </G>
        )}
        {tem('juncos') && (
          <G testID="item-juncos">
            {[246, 254, 262].map((x, k) => (
              <Path key={x} d={`M${x} ${wcy - 4} L${x + (k - 1) * 4} ${wcy - 40 - k * 6}`} stroke={pal.junco} strokeWidth={4} strokeLinecap="round" />
            ))}
          </G>
        )}
        {tem('folhaVitoriaRegia') && fase >= 2 && (
          <Ciclo
            ativo={ativo && plano.folhas >= 1}
            dur={2500}
            anim={(t) => {
              'worklet';
              return { transform: [{ translateY: -1.5 + 3 * t }] };
            }}
          >
            <G testID="item-folha-esquerda">
              <Folha x={FOLHA_ESQ.x} y={wcy - 8} rx={FOLHA_ESQ.rx} ry={FOLHA_ESQ.ry} agua={pal.agua} cor={pal.folha} sombra={pal.folhaSombra} />
            </G>
          </Ciclo>
        )}
        {folhaDireita && (
          <Ciclo
            ativo={ativo && plano.folhas >= 2}
            dur={2500}
            atraso={600}
            anim={(t) => {
              'worklet';
              return { transform: [{ translateY: 1.5 - 3 * t }] };
            }}
          >
            <G testID="item-folha-direita">
              <Folha x={folhaDir.x} y={wcy + 4} rx={folhaDir.rx} ry={folhaDir.ry} agua={pal.agua} cor={pal.folha} sombra={pal.folhaSombra} />
              {tem('flor') && (
                <G testID="item-flor">
                  {[0, 1, 2, 3, 4].map((k) => {
                    const a = ((-90 + k * 72) * Math.PI) / 180;
                    return (
                      <Ellipse
                        key={k}
                        cx={folhaDir.x - 8 + 14 * Math.cos(a)}
                        cy={wcy + 4 - 12 + 9 * Math.sin(a)}
                        rx={8}
                        ry={5}
                        fill="#FF8FB0"
                        transform={`rotate(${(a * 180) / Math.PI} ${folhaDir.x - 8 + 14 * Math.cos(a)} ${wcy + 4 - 12 + 9 * Math.sin(a)})`}
                      />
                    );
                  })}
                  <Ellipse cx={folhaDir.x - 8} cy={wcy - 8} rx={4} ry={4} fill="#FFD166" />
                </G>
              )}
            </G>
          </Ciclo>
        )}
        {tem('tronco') && (
          <G testID="item-tronco">
            <Ellipse cx={60} cy={wcy + 18} rx={30} ry={10} fill={pal.noite ? '#5A3C2A' : '#8A5A3C'} />
            <Ellipse cx={34} cy={wcy + 18} rx={7} ry={10} fill={pal.noite ? '#8A6C4C' : '#C49A6C'} />
          </G>
        )}
        {tem('aguape') && (
          <G testID="item-aguape">
            <Ellipse cx={236} cy={wcy + 14} rx={14} ry={9} fill={pal.folha} />
            <Ellipse cx={250} cy={wcy + 10} rx={10} ry={7} fill={pal.noite ? '#4FA03A' : '#6FCF4F'} />
            <Ellipse cx={238} cy={wcy - 10} rx={4} ry={14} fill="#8A6FD1" />
            <Ellipse cx={238} cy={wcy - 22} rx={4} ry={5} fill="#A98AE0" />
          </G>
        )}
      </Svg>

      <View style={[styles.sapo, { left: sapoEsq, top: sapoTopo, width: tamSapo, height: tamSapo }]} pointerEvents="none">
        <Sapo fase={fase} estado={estadoDoSapo} tamanho={tamSapo} reducedMotion={reduzir} salto={saltoDoSapo} semSombra />
      </View>

      {/* camada do céu na frente: vagalumes e chuva */}
      <Svg width={tamanho} height={tamanho} viewBox="0 0 300 300" style={StyleSheet.absoluteFill} pointerEvents="none">
        {tem('vagalumes') &&
          VAGALUMES.map(([x, y], k) => (
            <Ciclo
              key={x}
              ativo={ativo && k < plano.vagalumes}
              dur={2000 + (k % 3) * 500}
              atraso={k * 260}
              anim={(t) => {
                'worklet';
                return { opacity: 0.25 + 0.75 * t, transform: [{ translateX: -5 + 10 * t }, { translateY: 4 - 8 * t }] };
              }}
            >
              <Ellipse cx={x} cy={y} rx={9} ry={9} fill="#FFE066" fillOpacity={0.22} />
              <Ellipse cx={x} cy={y} rx={4.5} ry={4.5} fill="#FFE066" />
            </Ciclo>
          ))}
        {tem('nuvemDeChuva') &&
          [190, 204, 218, 232].map((x, k) => (
            <Gota key={x} x={x} y={62} atraso={k * 250} ativo={ativo && k < plano.gotas} cor={pal.noite ? '#8FB0E8' : '#6FA3D8'} />
          ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  sapo: { position: 'absolute' },
});
