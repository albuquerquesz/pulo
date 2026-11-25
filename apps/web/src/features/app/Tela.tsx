import type { ReactNode } from 'react';

import { Texto } from '@/ui';

type TelaProps = { titulo?: string; children: ReactNode };
/** `extra` fica à direita do título (um contador, por exemplo). */
type SecaoProps = { titulo: string; extra?: ReactNode; children: ReactNode };

/**
 * Moldura de cada tela: margens e título. O espaço da barra de baixo é da casca.
 * Mobile first: coluna estreita; a partir de md ocupa a coluna do meio, com as margens do rascunho.
 */
export function Tela({ titulo, children }: TelaProps) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-6 md:max-w-none md:gap-6 md:px-10 md:pt-8 md:pb-12">
      {titulo ? (
        <Texto como="h1" variante="titulo">
          {titulo}
        </Texto>
      ) : null}
      {children}
    </main>
  );
}

export function Secao({ titulo, extra, children }: SecaoProps) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <Texto como="h2" variante="subtitulo">
          {titulo}
        </Texto>
        {extra}
      </div>
      {children}
    </section>
  );
}
