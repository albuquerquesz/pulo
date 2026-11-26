import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import { ESPERA_PARA_GRAVAR_MS } from './logic';

/** Grava o que a pessoa digita depois de uma pausa; `agora()` grava na hora (sair do campo, fechar a gaveta). */
export function useTextoAdiado(gravar: (texto: string) => void) {
  const gravarRef = useRef(gravar);
  useLayoutEffect(() => {
    gravarRef.current = gravar;
  });
  const pendente = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const agora = useCallback(() => {
    clearTimeout(timer.current);
    const texto = pendente.current;
    pendente.current = null;
    if (texto !== null) gravarRef.current(texto);
  }, []);

  const digitar = useCallback(
    (texto: string) => {
      pendente.current = texto;
      clearTimeout(timer.current);
      timer.current = setTimeout(agora, ESPERA_PARA_GRAVAR_MS);
    },
    [agora],
  );

  useEffect(() => agora, [agora]);

  return { digitar, agora };
}
