import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useApp } from './AppProvider';

export type EstadoDeCarga<T> = { tipo: 'carregando' } | { tipo: 'erro' } | { tipo: 'ok'; dados: T };

/** Carrega ao focar a aba e sempre que `refresh()` é chamado. Mantém os dados antigos durante a recarga. */
export function useCarregar<T>(fn: () => Promise<T>): { estado: EstadoDeCarga<T>; recarregar: () => Promise<void> } {
  const { versao } = useApp();
  const [estado, setEstado] = useState<EstadoDeCarga<T>>({ tipo: 'carregando' });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const vivo = useRef(true);

  const recarregar = useCallback(async () => {
    try {
      const dados = await fnRef.current();
      if (vivo.current) setEstado({ tipo: 'ok', dados });
    } catch {
      if (vivo.current) setEstado({ tipo: 'erro' });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      vivo.current = true;
      void recarregar();
      return () => {
        vivo.current = false;
      };
      // `versao` entra de propósito: refresh() recarrega a tela.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recarregar, versao]),
  );

  return { estado, recarregar };
}
