import { useId, type ReactNode } from 'react';

import { TITULO } from './estilos';

type SecaoProps = { titulo: string; className?: string; children: ReactNode };

/** Título fora do cartão (`.sec`). Também é a referência de largura das grades de dentro. */
export function Secao({ titulo, className = '', children }: SecaoProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`@container flex min-w-0 flex-col gap-3 ${className}`}>
      <h2 id={id} className={TITULO}>
        {titulo}
      </h2>
      {children}
    </section>
  );
}
