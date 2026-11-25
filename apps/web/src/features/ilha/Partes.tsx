import type { ParteId } from '@pulo/core/domain/casa';
import { Joia } from '@/ui';

import type { ParteAVenda, SituacaoDaParte } from './logic';

const APARENCIA: Record<SituacaoDaParte, string> = {
  disponivel: 'cursor-pointer bg-white shadow-[inset_0_-5px_0_var(--pulo-sombra-branca)] hover:-translate-y-0.5',
  cara: 'bg-white opacity-50 shadow-[inset_0_-5px_0_var(--pulo-sombra-branca)]',
  feita: 'bg-pronta-fundo shadow-[inset_0_-5px_0_var(--pulo-pronta-borda)]',
};

type PartesProps = { partes: readonly ParteAVenda[]; onComprar: (id: ParteId) => void };

/** As partes à venda no pé da ilha (`.partes`). Só a que o saldo paga responde ao toque. */
export function Partes({ partes, onComprar }: PartesProps) {
  return (
    <ul aria-label="Partes da casa" className="flex flex-wrap justify-center gap-2 md:gap-3">
      {partes.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            disabled={p.situacao !== 'disponivel'}
            onClick={() => onComprar(p.id)}
            aria-label={p.situacao === 'feita' ? `${p.nome}, pronta` : `${p.nome}, ${p.custo} joias`}
            className={`flex min-h-11 items-center gap-2 rounded-[18px] border-4 border-contorno py-1.5 pr-3 pl-2.5 text-sm font-black text-contorno md:gap-2.5 md:py-2.5 md:pr-4 md:pl-3 md:text-[15px] ${APARENCIA[p.situacao]}`}
          >
            <span aria-hidden="true" className="text-xl md:text-2xl">
              {p.emoji}
            </span>
            <span>{p.nome}</span>
            {p.situacao === 'feita' ? (
              <span className="text-pronta-texto">✓</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-joia-escura">
                <Joia largura={14} altura={16} />
                {p.custo}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
