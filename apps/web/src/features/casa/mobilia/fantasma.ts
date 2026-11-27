import { CONTORNO } from './paleta';

/** O traço do lugar vazio. O preenchimento transparente deixa o miolo receber o toque. */
export const TRACEJADO = { fill: 'transparent', stroke: CONTORNO, strokeWidth: 3, strokeDasharray: '7 6' } as const;
