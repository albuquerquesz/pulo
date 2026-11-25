/** Entrega um objeto como arquivo JSON pelo navegador. */
export function baixarJson(nome: string, dados: object): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}
