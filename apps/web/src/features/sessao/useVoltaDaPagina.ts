import { useEffect, useRef } from 'react';

/**
 * Chama `aoVoltar` quando o navegador devolve a página guardada (botão voltar na tela do Google): o estado de
 * "entrando" voltaria preso junto com ela.
 */
export function useVoltaDaPagina(aoVoltar: () => void): void {
  const ref = useRef(aoVoltar);
  useEffect(() => {
    ref.current = aoVoltar;
  });
  useEffect(() => {
    const ouvir = (evento: PageTransitionEvent) => {
      if (evento.persisted) ref.current();
    };
    window.addEventListener('pageshow', ouvir);
    return () => window.removeEventListener('pageshow', ouvir);
  }, []);
}
