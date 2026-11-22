import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { lightColors } from '@/theme/tokens';

/** Tela provisória do passo 0. Substituída pelas telas da spec 09. */
export default function Index() {
  return (
    <View style={styles.root}>
      <Svg width={96} height={96} viewBox="0 0 100 100" accessibilityLabel="Sapo provisório">
        <Circle cx={50} cy={50} r={40} fill={lightColors.sapo} stroke={lightColors.sapoBorda} strokeWidth={4} />
      </Svg>
      <Text style={styles.title}>Pulo</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: lightColors.bg, gap: 12 },
  title: { fontSize: 32, fontWeight: '800', color: lightColors.ink },
});
