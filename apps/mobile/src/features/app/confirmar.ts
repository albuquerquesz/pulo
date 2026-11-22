import { Alert, Platform } from 'react-native';

/** Confirmação simples: janela do navegador na web, Alert no celular. */
export function confirmar(titulo: string, detalhe: string, ok: string, cancelar: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(`${titulo}\n${detalhe}`) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(titulo, detalhe, [
      { text: cancelar, style: 'cancel', onPress: () => resolve(false) },
      { text: ok, onPress: () => resolve(true) },
    ]);
  });
}
