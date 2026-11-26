import { addDays } from '@pulo/core/domain/day';
import type { DateKey } from '@pulo/core/domain/types';

/** Quanto tempo o aviso do gelo fica na tela antes de sumir sozinho. */
export const DURACAO_DO_AVISO_DO_GELO_MS = 8000;

/** "20/11". */
const diaEMes = (data: DateKey): string => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

/** O que o sapo conta sobre os dias que o gelo salvou (do mais antigo ao mais novo). */
export function textoDoAvisoDoGelo(dias: readonly DateKey[], hoje: DateKey): string {
  const [unico] = dias;
  if (dias.length === 1 && unico) {
    const quando = unico === addDays(hoje, -1) ? 'ontem' : `em ${diaEMes(unico)}`;
    return `O gelo segurou seu foguinho ${quando}.`;
  }
  const datas = dias.map(diaEMes);
  return `${dias.length} gelos seguraram seu foguinho em ${datas.slice(0, -1).join(', ')} e ${datas.at(-1)}.`;
}

/** Quantos descansos ainda cabem na semana, em palavras. */
export function textoDeDescansos(restantes: number, maximo: number): string {
  if (restantes <= 0) return `Você já usou os ${maximo} descansos desta semana`;
  return restantes === 1 ? 'Resta 1 descanso nesta semana' : `Restam ${restantes} descansos nesta semana`;
}
