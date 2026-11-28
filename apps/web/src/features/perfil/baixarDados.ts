/** Entrega os dados exportados como um arquivo JSON. */
export function baixarDados(dados: Record<string, unknown>, dia: string): void {
  const endereco = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = endereco;
  link.download = `pulo-dados-${dia}.json`;
  link.click();
  URL.revokeObjectURL(endereco);
}
