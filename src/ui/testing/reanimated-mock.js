/* Mock mínimo do Reanimated para o Jest (o mock oficial exige o resolver do worklets no package.json). */
const React = require('react');
const { View } = require('react-native');

const id = (v) => v;
const easing = new Proxy(() => id, { get: () => easing, apply: () => id });

module.exports = {
  __esModule: true,
  default: { View, createAnimatedComponent: id },
  createAnimatedComponent: id,
  useSharedValue: (v) => React.useRef({ value: v }).current,
  useAnimatedProps: (fn) => fn(),
  useAnimatedStyle: (fn) => fn(),
  withTiming: (to) => to,
  withSpring: (to) => to,
  withDelay: (_d, a) => a,
  withRepeat: (a) => a,
  withSequence: (...a) => a[a.length - 1],
  cancelAnimation: () => undefined,
  Easing: easing,
};
