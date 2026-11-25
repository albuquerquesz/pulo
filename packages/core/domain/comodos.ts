import { type ComodoId, HOUSE, type ParteDaCasa } from '../config/decisions';
import type { RoomSpot } from './types';

/*
 * Os cômodos decoráveis (spec 31). Módulo pequeno de propósito: o banco e os schemas leem daqui
 * sem puxar as regras de joias.
 */

export interface ComodoDaCasa extends ParteDaCasa {
  id: ComodoId;
}

export const ehComodo = (item: string): item is ComodoId => HOUSE.parts.some((p) => p.id === item && p.camada === 'comodo');
const ehParteDeComodo = (parte: ParteDaCasa): parte is ComodoDaCasa => parte.camada === 'comodo';

/** As partes que viram um cômodo decorável, na ordem do catálogo. */
export const COMODOS: readonly ComodoDaCasa[] = HOUSE.parts.filter(ehParteDeComodo);
/** O cômodo que já vem pronto, e onde vai a decoração sem cômodo. */
export const COMODO_INICIAL: ComodoId = 'quarto';

/** O cômodo de um item decorado (ausente é o quarto). */
export const comodoDe = ({ comodo }: Pick<RoomSpot, 'comodo'>): ComodoId => comodo ?? COMODO_INICIAL;
