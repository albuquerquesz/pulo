import { useCallback, useEffect, useRef, useState } from 'react';

const DURACAO_MS = 500;

/**
 * O saldo da tela durante uma compra: fica parado enquanto as joias voam, desce contando quando elas pousam e volta
 * ao valor de verdade (`null`) no `soltar`.
 */
export function useSaldoContando() {
  const [naTela, setNaTela] = useState<number | null>(null);
  const quadro = useRef(0);
  const parar = useCallback(() => cancelAnimationFrame(quadro.current), []);
  useEffect(() => parar, [parar]);

  const segurar = useCallback(
    (valor: number) => {
      parar();
      setNaTela(valor);
    },
    [parar],
  );
  const descer = useCallback(
    (de: number, para: number) => {
      parar();
      const inicio = performance.now();
      const passo = (agora: number) => {
        const t = Math.min(1, Math.max(0, (agora - inicio) / DURACAO_MS));
        setNaTela(Math.round(de + (para - de) * (1 - (1 - t) ** 3)));
        if (t < 1) quadro.current = requestAnimationFrame(passo);
      };
      quadro.current = requestAnimationFrame(passo);
    },
    [parar],
  );
  const soltar = useCallback(() => {
    parar();
    setNaTela(null);
  }, [parar]);

  return { naTela, segurar, descer, soltar };
}
