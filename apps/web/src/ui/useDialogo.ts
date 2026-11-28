import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

const FOCAVEIS = 'a[href], button, input, select, textarea, summary, [tabindex]';

interface Camada {
  teclar: (e: KeyboardEvent) => void;
}

/** Os diálogos abertos, do mais antigo ao que está por cima: só o último responde ao teclado. */
const camadas: Camada[] = [];
const aoTeclar = (e: KeyboardEvent) => camadas.at(-1)?.teclar(e);

const alcancaveis = (caixa: Element): HTMLElement[] =>
  [...caixa.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((el) => !el.matches(':disabled, [tabindex="-1"], [hidden], [hidden] *, [inert] *'));

/** Tab e Shift+Tab dão a volta dentro da caixa. */
function prenderFoco(e: KeyboardEvent, caixa: Element): void {
  const itens = alcancaveis(caixa);
  const primeiro = itens[0];
  const ultimo = itens.at(-1);
  if (!primeiro || !ultimo) {
    e.preventDefault();
    return;
  }
  const atual = document.activeElement;
  const fora = !caixa.contains(atual);
  const naBorda = e.shiftKey ? atual === primeiro || !itens.some((i) => i === atual) : atual === ultimo;
  if (!fora && !naBorda) return;
  e.preventDefault();
  (e.shiftKey ? ultimo : primeiro).focus();
}

export interface OpcoesDoDialogo {
  aberto: boolean;
  /** Esc. */
  onFechar: () => void;
  /** O diálogo inteiro: é dele que o foco não sai. */
  caixa: RefObject<HTMLElement | null>;
  /** Quem recebe o foco ao abrir; sem ele, a própria caixa. */
  foco?: RefObject<HTMLElement | null>;
  /** `false` num painel que deixa o resto da tela em uso. */
  prender?: boolean;
}

/** O teclado de um diálogo: foco ao abrir, Tab preso, Esc fecha e o foco volta para onde estava. */
export function useDialogo({ aberto, onFechar, caixa, foco, prender = true }: OpcoesDoDialogo): void {
  const fechar = useRef(onFechar);
  useLayoutEffect(() => {
    fechar.current = onFechar;
  });

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement;
    // Um campo com foco automático fica com o foco.
    if (!caixa.current?.contains(document.activeElement)) (foco ?? caixa).current?.focus();
    const camada: Camada = {
      teclar: (e) => {
        if (e.key === 'Escape') fechar.current();
        else if (e.key === 'Tab' && prender && caixa.current) prenderFoco(e, caixa.current);
      },
    };
    if (camadas.length === 0) window.addEventListener('keydown', aoTeclar);
    camadas.push(camada);
    return () => {
      camadas.splice(camadas.indexOf(camada), 1);
      if (camadas.length === 0) window.removeEventListener('keydown', aoTeclar);
      if (anterior instanceof HTMLElement) anterior.focus();
    };
  }, [aberto, caixa, foco, prender]);
}
