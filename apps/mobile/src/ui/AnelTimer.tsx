import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/theme/useTheme';

import { Texto } from './Texto';

const ACircle = Animated.createAnimatedComponent(Circle);

export type EstadoDoAnel = 'parado' | 'rodando' | 'pausa' | 'concluido';

export interface AnelTimerProps {
  /** Tempo restante e total, em ms. O anel só desenha; quem conta o tempo é o domínio. */
  remainingMs: number;
  totalMs: number;
  estado: EstadoDoAnel;
  tamanho?: number;
  testID?: string;
}

export function formatarTempo(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const ROTULO: Record<EstadoDoAnel, string> = {
  parado: 'Pronto para começar',
  rodando: 'Em foco',
  pausa: 'Pausado',
  concluido: 'Concluído',
};

export function descricaoDoAnel(remainingMs: number, estado: EstadoDoAnel): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const tempo = estado === 'concluido' ? 'tempo concluído' : `${m} minutos e ${s} segundos restantes`;
  return `Timer, ${tempo}, ${ROTULO[estado].toLowerCase()}`;
}

export function AnelTimer({ remainingMs, totalMs, estado, tamanho = 240, testID }: AnelTimerProps) {
  const t = useTheme();
  const c = t.cores;
  const espessura = Math.max(10, tamanho * 0.075);
  const r = (tamanho - espessura) / 2;
  const circ = 2 * Math.PI * r;
  const fracao = estado === 'concluido' ? 1 : totalMs <= 0 ? 0 : Math.min(1, Math.max(0, remainingMs / totalMs));
  const alvo = estado === 'parado' ? 1 : fracao;

  const progresso = useSharedValue(alvo);
  useEffect(() => {
    // o timer atualiza a cada segundo: um deslizar linear de 1 s deixa o anel contínuo
    progresso.value = withTiming(alvo, {
      duration: t.reduzirMovimento ? 0 : estado === 'rodando' ? 1000 : t.movimento.slow,
      easing: estado === 'rodando' ? Easing.linear : Easing.out(Easing.cubic),
    });
  }, [alvo, estado, t.reduzirMovimento, t.movimento.slow, progresso]);

  const props = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - progresso.value) }));

  const cor = { parado: c.agua, rodando: c.foco, pausa: c.descanso, concluido: c.sapo }[estado];
  const corBorda = { parado: c.aguaBorda, rodando: c.focoBorda, pausa: c.descansoBorda, concluido: c.sapoBorda }[estado];

  return (
    <View
      style={{ width: tamanho, height: tamanho }}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={descricaoDoAnel(remainingMs, estado)}
      testID={testID}
    >
      <Svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`}>
        <Circle cx={tamanho / 2} cy={tamanho / 2} r={r} stroke={c.line} strokeWidth={espessura} fill="none" />
        <ACircle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={r}
          stroke={cor}
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeDasharray={circ}
          animatedProps={props}
          fill="none"
          transform={`rotate(-90 ${tamanho / 2} ${tamanho / 2})`}
        />
        <Circle cx={tamanho / 2} cy={tamanho / 2} r={r - espessura * 0.85} stroke={corBorda} strokeOpacity={0.18} strokeWidth={2} fill="none" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.centro]} pointerEvents="none">
        {estado === 'concluido' ? (
          <Svg width={tamanho * 0.22} height={tamanho * 0.22} viewBox="0 0 24 24">
            <Path d="M4 12.5 L10 18 L20 6" stroke={c.sapoBorda} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
        ) : (
          <Texto tabular style={{ fontSize: tamanho * 0.22, lineHeight: tamanho * 0.26, fontWeight: '800' }}>
            {formatarTempo(remainingMs)}
          </Texto>
        )}
        <Texto variante="legenda" cor="muted">
          {ROTULO[estado]}
        </Texto>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { alignItems: 'center', justifyContent: 'center', gap: 4 },
});
