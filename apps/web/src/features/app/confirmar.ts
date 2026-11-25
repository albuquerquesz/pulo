/** Confirmação simples com a janela do navegador. */
export function confirmar(titulo: string, detalhe: string) {
  return Promise.resolve(typeof window === 'undefined' ? true : window.confirm(`${titulo}\n${detalhe}`));
}

/** Pergunta um texto com a janela do navegador; `null` se a pessoa cancelar ou deixar em branco. */
export function perguntar(pergunta: string): string | null {
  return window.prompt(pergunta)?.trim() || null;
}
