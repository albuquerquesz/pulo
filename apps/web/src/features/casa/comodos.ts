import type { ComodoId } from '@pulo/core/domain/casa';

import { cor, mistura } from '@/mascot/cores';

/** As cores de cada cômodo, sempre a partir dos tokens. */
export interface CoresDoComodo {
  paredeEsquerda: string;
  paredeDireita: string;
  rodape: string;
  piso: string;
  /** A espessura do chão, vista de frente. */
  baseEsquerda: string;
  baseDireita: string;
}

const AZUL = { baseEsquerda: mistura('etiqueta-azul', 65, 'contorno'), baseDireita: cor('etiqueta-azul') };
const MADEIRA = { baseEsquerda: cor('madeira-escura'), baseDireita: cor('madeira') };
const ROXO = { baseEsquerda: cor('descanso-borda'), baseDireita: cor('descanso') };

export const CORES_DOS_COMODOS: Record<ComodoId, CoresDoComodo> = {
  quarto: { paredeEsquerda: mistura('lima-clara', 35, 'bege'), paredeDireita: cor('creme'), rodape: cor('agua'), piso: mistura('madeira-clara', 55, 'madeira'), ...AZUL },
  cozinha: { paredeEsquerda: mistura('sol', 45, 'bege'), paredeDireita: mistura('sol', 28, 'creme'), rodape: cor('foco'), piso: mistura('creme', 55, 'madeira-clara'), ...MADEIRA },
  sala: { paredeEsquerda: mistura('etiqueta-rosa', 40, 'bege'), paredeDireita: mistura('etiqueta-rosa', 25, 'creme'), rodape: cor('cancelar'), piso: cor('madeira'), ...MADEIRA },
  banheiro: { paredeEsquerda: mistura('etiqueta-azul', 30, 'ceu'), paredeDireita: cor('ceu'), rodape: cor('etiqueta-azul'), piso: mistura('ceu', 40, 'sombra-branca'), ...AZUL },
  escritorio: { paredeEsquerda: mistura('etiqueta-cinza', 55, 'bege'), paredeDireita: mistura('etiqueta-cinza', 35, 'creme'), rodape: cor('timer-verde-borda'), piso: cor('madeira-escura'), ...MADEIRA },
  biblioteca: { paredeEsquerda: mistura('madeira', 45, 'bege'), paredeDireita: mistura('madeira-clara', 40, 'creme'), rodape: cor('cancelar-borda'), piso: mistura('madeira-escura', 75, 'contorno'), ...MADEIRA },
  estudio: { paredeEsquerda: mistura('joia', 35, 'bege'), paredeDireita: mistura('joia-clara', 70, 'creme'), rodape: cor('joia-escura'), piso: mistura('madeira', 60, 'cancelar'), ...ROXO },
  observatorio: { paredeEsquerda: mistura('descanso', 70, 'contorno'), paredeDireita: cor('descanso'), rodape: cor('sol'), piso: mistura('descanso-borda', 55, 'etiqueta-cinza'), ...ROXO },
};
