import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useApp } from './AppProvider';
import { falhaDe, type Falha } from './falha';

export type EstadoDeCarga<T> = { tipo: 'carregando' } | { tipo: 'erro'; falha: Falha } | { tipo: 'ok'; dados: T };

/** Carrega ao abrir a tela e sempre que `refresh()` é chamado. Mantém os dados antigos durante a recarga. */
export function useCarregar<T>(fn: () => Promise<T>): { estado: EstadoDeCarga<T>; recarregar: () => Promise<void> } {
  const { versao } = useApp();
  const [estado, setEstado] = useState<EstadoDeCarga<T>>({ tipo: 'carregando' });
  const fnRef = useRef(fn);
  // Guarda a função mais recente fora do render, antes dos efeitos que a chamam.
  useLayoutEffect(() => {
    fnRef.current = fn;
  });
  const vivo = useRef(true);

  const recarregar = useCallback(async () => {
    try {
      const dados = await fnRef.current();
      if (vivo.current) setEstado({ tipo: 'ok', dados });
    } catch (erro) {
      if (vivo.current) setEstado({ tipo: 'erro', falha: falhaDe(erro) });
    }
  }, []);

  useEffect(() => {
    vivo.current = true;
    void recarregar();
    return () => {
      vivo.current = false;
    };
    // `versao` entra de propósito: refresh() recarrega a tela.
  }, [recarregar, versao]);

  return { estado, recarregar };
}
