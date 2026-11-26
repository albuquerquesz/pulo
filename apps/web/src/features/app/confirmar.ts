/** Confirmação simples com a janela do navegador. */
export function confirmar(titulo: string, detalhe: string) {
  return Promise.resolve(typeof window === 'undefined' ? true : window.confirm(`${titulo}\n${detalhe}`));
}
