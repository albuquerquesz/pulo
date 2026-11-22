import { useFonts } from 'expo-font';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';

/**
 * Nunito (pacote @expo-google-fonts/nunito, fonte OFL 1.1). Os três pesos entram numa chamada só
 * (exigência do web). Devolve true quando carregou; em erro, o app segue com a fonte do sistema.
 */
export function useFontesPulo(): boolean {
  const [carregou, erro] = useFonts({ Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold });
  return carregou && !erro;
}
