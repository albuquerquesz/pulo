/** Matriz de transformação com pivô, no formato que o <G> do react-native-svg aceita. Worklet. */
export function comPivo(
  px: number,
  py: number,
  sx: number,
  sy: number,
  tx = 0,
  ty = 0,
  graus = 0,
) {
  'worklet';
  return [
    { translateX: px + tx },
    { translateY: py + ty },
    { rotate: `${graus}deg` },
    { scaleX: sx },
    { scaleY: sy },
    { translateX: -px },
    { translateY: -py },
  ];
}
