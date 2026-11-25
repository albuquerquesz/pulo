import { useSyncExternalStore } from 'react';

/** Largura do conteúdo: no celular a coluna é no máximo max-w-xl (576 px), com 16 px de margem de cada lado. */
const COLUNA_MAX = 576;
const MARGENS = 32;
/** Casca do rascunho: a partir de md há a barra lateral e margens de 40 px; nas telas largas, também o trilho. */
const TELA_MD = 768;
const TELA_COM_TRILHO = 1280;
const BARRA_LATERAL = 312;
const TRILHO = 460;
const MARGENS_MD = 80;
/** Largura de um celular comum, usada no servidor antes de medir a janela. */
const LARGURA_NO_SERVIDOR = 375;

/** Lado que cabe na coluna do meio para uma janela desta largura. */
export function ladoDoConteudo(janela: number) {
  if (janela < TELA_MD) return Math.min(janela, COLUNA_MAX) - MARGENS;
  const coluna = janela - BARRA_LATERAL - (janela >= TELA_COM_TRILHO ? TRILHO : 0);
  return Math.min(coluna - MARGENS_MD, COLUNA_MAX - MARGENS);
}

function assinar(avisar: () => void) {
  window.addEventListener('resize', avisar);
  return () => window.removeEventListener('resize', avisar);
}

/** Lado útil para desenhos quadrados (lagoa), acompanhando a janela. */
export function useLadoDoConteudo() {
  const largura = useSyncExternalStore(assinar, () => window.innerWidth, () => LARGURA_NO_SERVIDOR);
  return ladoDoConteudo(largura);
}
