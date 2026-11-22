import type { ReactNode } from 'react';

import { Texto } from '@/ui';

type TelaProps = { titulo?: string; children: ReactNode; semBarra?: boolean };
type SecaoProps = { titulo: string; children: ReactNode };

/**
 * Moldura de cada tela: margens, título e espaço para a barra de abas.
 * Mobile first: coluna estreita; a barra fica embaixo no celular e ao lado a partir de md.
 */
export function Tela({ titulo, children, semBarra }: TelaProps) {
  return (
    <main className={`mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] ${semBarra ? 'pb-6' : 'pb-28 md:pb-8'}`}>
      {titulo ? (
        <Texto como="h1" variante="titulo">
          {titulo}
        </Texto>
      ) : null}
      {children}
    </main>
  );
}

export function Secao({ titulo, children }: SecaoProps) {
  return (
    <section className="flex flex-col gap-2">
      <Texto como="h2" variante="subtitulo">
        {titulo}
      </Texto>
      {children}
    </section>
  );
}
