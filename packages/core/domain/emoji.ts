const GRAFEMAS = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });
/** Figura, bandeira ou tecla (como 1️⃣). */
const FIGURA = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u;

export const TEXTO_DO_ICONE = 'O ícone é um emoji só.';

/** Um emoji só, mesmo os compostos (família, bandeira, tom de pele). */
export function ehUmEmoji(texto: string): boolean {
  return [...GRAFEMAS.segment(texto)].length === 1 && FIGURA.test(texto);
}
