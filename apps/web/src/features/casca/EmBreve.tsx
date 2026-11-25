import { Cartao, Texto } from '@/ui';

import { Tela } from '../app';

/** Lugar de uma tela do rascunho que ainda vai ser construída. */
export function EmBreve({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Tela titulo={titulo}>
      <Cartao>
        <Texto cor="muted">{texto}</Texto>
      </Cartao>
    </Tela>
  );
}
