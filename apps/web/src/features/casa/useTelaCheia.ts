import { useEffect, useState, type RefObject } from 'react';

/** Liga e desliga a tela cheia num elemento (Fullscreen API). */
export function useTelaCheia(alvo: RefObject<HTMLElement | null>) {
  const [cheia, setCheia] = useState(false);
  useEffect(() => {
    const mudou = () => setCheia(alvo.current !== null && document.fullscreenElement === alvo.current);
    document.addEventListener('fullscreenchange', mudou);
    return () => document.removeEventListener('fullscreenchange', mudou);
  }, [alvo]);
  const alternar = () => {
    // O navegador pode recusar (ou não ter a API, como no iPhone): a tela só fica como está.
    const pedido = document.fullscreenElement ? document.exitFullscreen?.() : alvo.current?.requestFullscreen?.();
    pedido?.catch(() => undefined);
  };
  return { cheia, alternar };
}
