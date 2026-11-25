/*
 * Cores dos desenhos da ilha e dos cômodos: sempre tokens de styles.css, puros ou misturados.
 * Nenhuma cor solta.
 */
export type Token =
  | 'agua' | 'agua-borda' | 'bege' | 'bege-borda' | 'cancelar' | 'cancelar-borda' | 'ceu' | 'contorno' | 'creme'
  | 'descanso' | 'descanso-borda' | 'etiqueta-azul' | 'etiqueta-cinza' | 'etiqueta-rosa' | 'folha' | 'foco'
  | 'joia' | 'joia-clara' | 'joia-escura' | 'lima' | 'lima-clara' | 'lima-forte' | 'madeira' | 'madeira-clara'
  | 'madeira-escura' | 'sapo' | 'sapo-borda' | 'sol' | 'sol-quente' | 'sombra-branca' | 'timer-ouro'
  | 'timer-verde' | 'timer-verde-borda';

export const cor = (token: Token): string => `var(--pulo-${token})`;

/** `porcento` de `a`, o resto de `b`. */
export const mistura = (a: Token, porcento: number, b: Token): string => `color-mix(in srgb, ${cor(a)} ${porcento}%, ${cor(b)})`;
