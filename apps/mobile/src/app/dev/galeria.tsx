import { Redirect } from 'expo-router';

import { Galeria } from '@/ui';

/** Só em desenvolvimento. Em produção volta para Hoje. */
export default function GaleriaRota() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Galeria />;
}
