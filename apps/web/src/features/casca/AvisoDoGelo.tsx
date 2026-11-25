import { useEffect, useRef, useState } from 'react';

import { marcarGeloVisto } from '@pulo/core/domain/gelo';
import type { DateKey } from '@pulo/core/domain/types';

import { useApp } from '../app';
import { DURACAO_DO_AVISO_DO_GELO_MS, textoDoAvisoDoGelo } from './gelo';
import { RostoDoSapo } from './RostoDoSapo';

type AvisoDoGeloProps = { dias: readonly DateKey[]; hoje: DateKey };

/** O balão do sapo depois de um gelo gasto: aparece uma vez, some sozinho ou ao tocar, e conta como visto. */
export function AvisoDoGelo({ dias, hoje }: AvisoDoGeloProps) {
  const { repo, clock, emitirEvento } = useApp();
  const chave = dias.join();
  const [dispensado, setDispensado] = useState('');
  const aberto = chave !== '' && chave !== dispensado;

  const dispensar = () => {
    setDispensado(chave);
    // Se o servidor recusar, o repositório avisa e o balão volta numa próxima abertura.
    marcarGeloVisto(repo, clock).catch(() => undefined);
  };
  const dispensarRef = useRef(dispensar);
  useEffect(() => {
    dispensarRef.current = dispensar;
  });

  useEffect(() => {
    if (!aberto) return;
    emitirEvento('feliz');
    const id = setTimeout(() => dispensarRef.current(), DURACAO_DO_AVISO_DO_GELO_MS);
    return () => clearTimeout(id);
  }, [aberto, chave, emitirEvento]);

  if (!aberto) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-40 flex justify-center px-4">
      <button
        type="button"
        onClick={dispensar}
        className="pointer-events-auto flex max-w-md cursor-pointer items-center gap-3 rounded-[22px] border-4 border-contorno bg-surface px-4 py-3 text-left font-extrabold text-ink shadow-[inset_0_-5px_0_var(--pulo-agua)]"
      >
        <RostoDoSapo className="size-11 shrink-0" />
        <span>{textoDoAvisoDoGelo(dias, hoje)}</span>
      </button>
    </div>
  );
}
