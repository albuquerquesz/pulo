import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

/** Uma opção do seletor: o valor guardado e o texto que aparece. */
export type OpcaoDeEscolha = { valor: string; rotulo: string };

type EscolhaProps = { rotulo: string; valor: string; opcoes: readonly OpcaoDeEscolha[]; onEscolher: (valor: string) => void };

/** Altura máxima da lista; abaixo disso de espaço livre, ela abre para cima. */
const ALTURA_DA_LISTA = 288;

/**
 * Um seletor com a cara do app: o botão mostra o valor e a setinha, e a lista abre num cartão
 * com a opção escolhida marcada. Teclado: setas, Home e End andam; Enter ou espaço escolhem; Esc fecha.
 */
export function Escolha({ rotulo, valor, opcoes, onEscolher }: EscolhaProps) {
  const id = useId();
  const caixa = useRef<HTMLSpanElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const [aberta, setAberta] = useState(false);
  const [paraCima, setParaCima] = useState(false);
  const indiceDoValor = Math.max(0, opcoes.findIndex((o) => o.valor === valor));
  const [ativa, setAtiva] = useState(indiceDoValor);
  const escolhida = opcoes[indiceDoValor];

  function abrir() {
    const espacoAbaixo = window.innerHeight - (caixa.current?.getBoundingClientRect().bottom ?? 0);
    setParaCima(espacoAbaixo < ALTURA_DA_LISTA);
    setAtiva(indiceDoValor);
    setAberta(true);
  }

  function escolher(indice: number) {
    const opcao = opcoes[indice];
    setAberta(false);
    if (opcao && opcao.valor !== valor) onEscolher(opcao.valor);
  }

  // Clique fora fecha.
  useEffect(() => {
    if (!aberta) return;
    const fora = (e: PointerEvent) => {
      if (e.target instanceof Node && !caixa.current?.contains(e.target)) setAberta(false);
    };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [aberta]);

  // A opção ativa sempre à vista dentro da lista.
  useEffect(() => {
    if (aberta) lista.current?.querySelector(`[data-indice="${ativa}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [aberta, ativa]);

  function teclar(e: KeyboardEvent<HTMLButtonElement>) {
    const ultima = opcoes.length - 1;
    const mover: Record<string, number> = { ArrowDown: Math.min(ultima, ativa + 1), ArrowUp: Math.max(0, ativa - 1), Home: 0, End: ultima };
    if (!aberta) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        abrir();
      }
      return;
    }
    const destino = mover[e.key];
    if (destino !== undefined) {
      e.preventDefault();
      setAtiva(destino);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      escolher(ativa);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      if (e.key === 'Escape') e.preventDefault();
      setAberta(false);
    }
  }

  return (
    <span ref={caixa} className="relative inline-flex shrink-0">
      <button
        type="button"
        role="combobox"
        aria-label={rotulo}
        aria-haspopup="listbox"
        aria-expanded={aberta}
        aria-controls={`${id}-lista`}
        aria-activedescendant={aberta ? `${id}-${ativa}` : undefined}
        onClick={() => (aberta ? setAberta(false) : abrir())}
        onKeyDown={teclar}
        className={`flex min-h-11 min-w-[132px] cursor-pointer items-center justify-between gap-3 rounded-md border-[1.5px] bg-surface py-2 pr-3 pl-3.5 font-extrabold text-ink outline-none hover:border-muted/50 focus-visible:border-foco ${
          aberta ? 'border-foco' : 'border-line'
        }`}
      >
        <span className="truncate">{escolhida?.rotulo}</span>
        <svg viewBox="0 0 20 20" aria-hidden="true" className={`size-4 shrink-0 text-muted transition-transform duration-200 ${aberta ? 'rotate-180' : ''}`}>
          <path d="M5 7.5 L10 12.5 L15 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <ul
        ref={lista}
        id={`${id}-lista`}
        role="listbox"
        aria-label={rotulo}
        hidden={!aberta}
        className={`absolute right-0 z-30 max-h-72 min-w-full overflow-y-auto rounded-md border border-line bg-surface p-1.5 shadow-[0_10px_28px_rgba(31,42,36,0.16)] ${
          paraCima ? 'bottom-full mb-2 origin-bottom' : 'top-full mt-2 origin-top'
        } animate-[escolha-abre_140ms_ease-out]`}
      >
        {opcoes.map((opcao, i) => {
          const marcada = i === indiceDoValor;
          return (
            <li
              key={opcao.valor}
              id={`${id}-${i}`}
              data-indice={i}
              role="option"
              aria-selected={marcada}
              onPointerEnter={() => setAtiva(i)}
              onClick={() => escolher(i)}
              className={`flex min-h-10 cursor-pointer items-center justify-between gap-4 rounded-[12px] px-3 py-2 whitespace-nowrap ${
                i === ativa ? 'bg-bg' : ''
              } ${marcada ? 'font-extrabold text-ink' : 'font-semibold text-muted'}`}
            >
              {opcao.rotulo}
              {marcada ? (
                <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 shrink-0 text-sapo-borda">
                  <path d="M4.5 10.5 L8.5 14 L15.5 6.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </li>
          );
        })}
      </ul>
    </span>
  );
}
