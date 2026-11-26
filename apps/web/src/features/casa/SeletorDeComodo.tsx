import { COMODOS, type ComodoId } from '@pulo/core/domain/casa';

type SeletorDeComodoProps = {
  /** Os cômodos prontos. */
  meus: readonly ComodoId[];
  atual: ComodoId;
  onEscolher: (comodo: ComodoId) => void;
};

/** Os cômodos da pessoa no topo da Casa, numa faixa que rola de lado. */
export function SeletorDeComodo({ meus, atual, onEscolher }: SeletorDeComodoProps) {
  return (
    <div role="group" aria-label="Cômodo" className="pointer-events-auto flex max-w-full min-w-0 gap-2 overflow-x-auto p-1">
      {COMODOS.filter((c) => meus.includes(c.id)).map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={c.id === atual}
          onClick={() => onEscolher(c.id)}
          className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-[18px] border-4 border-contorno bg-folha px-3 py-1.5 text-sm font-black whitespace-nowrap text-contorno shadow-[inset_0_-5px_0_var(--pulo-sombra-branca)] aria-pressed:bg-lima-forte aria-pressed:shadow-[inset_0_-5px_0_var(--pulo-lima)]"
        >
          <span aria-hidden="true" className="text-xl">
            {c.emoji}
          </span>
          {c.nome}
        </button>
      ))}
    </div>
  );
}
