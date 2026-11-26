import { useSyncExternalStore } from 'react';

import { COMODO_INICIAL, ehComodo, type ComodoId } from '@pulo/core/domain/casa';

/*
 * O cômodo em que o sapo está: preferência só deste aparelho (spec 31), sem coluna no servidor.
 */

export const CHAVE_DO_COMODO = 'pulo.comodo';

const ouvintes = new Set<() => void>();
/** Vale quando o navegador não deixa usar o armazenamento. */
let semArmazenamento: ComodoId = COMODO_INICIAL;

export function lerComodo(): ComodoId {
  try {
    const salvo = window.localStorage.getItem(CHAVE_DO_COMODO);
    return salvo && ehComodo(salvo) ? salvo : COMODO_INICIAL;
  } catch {
    return semArmazenamento;
  }
}

export function guardarComodo(comodo: ComodoId): void {
  semArmazenamento = comodo;
  try {
    window.localStorage.setItem(CHAVE_DO_COMODO, comodo);
  } catch {
    // A escolha vale até fechar o app.
  }
  for (const avisar of ouvintes) avisar();
}

function assinar(avisar: () => void) {
  ouvintes.add(avisar);
  return () => void ouvintes.delete(avisar);
}

/** O cômodo escolhido, só entre os que a pessoa tem. */
export function useComodoAtual(meus: readonly ComodoId[]): ComodoId {
  const escolhido = useSyncExternalStore(assinar, lerComodo, () => COMODO_INICIAL);
  return meus.includes(escolhido) ? escolhido : COMODO_INICIAL;
}
