import { useSyncExternalStore } from 'react';

/** Largura do conteúdo: a coluna é no máximo max-w-xl (576 px), com 16 px de margem de cada lado. */
const COLUNA_MAX = 576;
const MARGENS = 32;
/** Largura de um celular comum, usada no servidor antes de medir a janela. */
const LARGURA_NO_SERVIDOR = 375;

function assinar(avisar: () => void) {
  window.addEventListener('resize', avisar);
  return () => window.removeEventListener('resize', avisar);
}

/** Lado útil para desenhos quadrados (lagoa), acompanhando a janela. */
export function useLadoDoConteudo() {
  const largura = useSyncExternalStore(assinar, () => window.innerWidth, () => LARGURA_NO_SERVIDOR);
  return Math.min(largura, COLUNA_MAX) - MARGENS;
}
