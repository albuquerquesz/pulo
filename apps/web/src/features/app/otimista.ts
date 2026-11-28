/**
 * Mostra a escrita otimista na hora e relê quando ela termina (ou volta atrás, se o servidor recusar).
 * O erro da escrita segue para quem chamou.
 */
export async function comEscritaOtimista<T>(escrita: () => Promise<T>, recarregar: () => Promise<void>): Promise<T> {
  const pendente = escrita();
  const otimista = setTimeout(() => void recarregar());
  try {
    return await pendente;
  } finally {
    clearTimeout(otimista);
    await recarregar();
  }
}
