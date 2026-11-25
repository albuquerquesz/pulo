import { cor, mistura } from '../cores';

/** As cores das peças da ilha, a partir dos tokens do tema (os tons imitam o rascunho). */
export const CONTORNO = cor('contorno');
export const PAREDE = { esquerda: mistura('creme', 55, 'bege-borda'), direita: cor('creme'), topo: cor('folha') };
export const TELHADO = { fundo: mistura('timer-ouro', 72, 'madeira-escura'), empena: mistura('timer-ouro', 45, 'creme'), frente: cor('timer-ouro') };
export const TELHADO_ROSA = { fundo: cor('cancelar-borda'), empena: mistura('cancelar', 35, 'creme'), frente: cor('cancelar') };
export const TELHADO_AZUL = { fundo: mistura('etiqueta-azul', 65, 'contorno'), empena: mistura('etiqueta-azul', 30, 'creme'), frente: cor('etiqueta-azul') };
export const MADEIRA = { esquerda: cor('madeira-escura'), direita: cor('madeira'), topo: cor('madeira-clara') };
export const PEDRA = { esquerda: cor('etiqueta-cinza'), direita: mistura('etiqueta-cinza', 55, 'sombra-branca'), topo: cor('sombra-branca') };
export const VIDRO = mistura('ceu', 75, 'etiqueta-azul');
export const MOLDURA = cor('folha');
export const GRAMA = mistura('sapo', 62, 'lima-clara');
export const FOLHAGEM = cor('timer-verde');
export const FOLHAGEM_ESCURA = cor('timer-verde-borda');
export const AGUA = mistura('etiqueta-azul', 55, 'ceu');
export const ESPUMA = cor('ceu');
