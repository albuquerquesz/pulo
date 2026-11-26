/** Uma opção do seletor: o valor guardado e o texto que aparece. */
export type OpcaoDeEscolha = { valor: string; rotulo: string };

type EscolhaProps = { rotulo: string; valor: string; opcoes: readonly OpcaoDeEscolha[]; onEscolher: (valor: string) => void };

/** Um seletor com cara de seletor: borda, o valor escolhido e a setinha para baixo. */
export function Escolha({ rotulo, valor, opcoes, onEscolher }: EscolhaProps) {
  return (
    <span className="relative inline-flex shrink-0">
      <select
        aria-label={rotulo}
        value={valor}
        onChange={(e) => onEscolher(e.target.value)}
        className="min-h-11 min-w-[132px] cursor-pointer appearance-none rounded-md border-[1.5px] border-line bg-surface py-2 pr-10 pl-3.5 font-extrabold text-ink outline-none hover:border-muted/50 focus-visible:border-foco"
      >
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor} className="bg-surface text-ink">
            {o.rotulo}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 20 20" aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted">
        <path d="M5 7.5 L10 12.5 L15 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
