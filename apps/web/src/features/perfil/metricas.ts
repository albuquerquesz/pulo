import type { Period, Weekday } from '@pulo/core/domain/types';

/** Sem dado ainda. */
export const SEM_NUMERO = '—';

const PERIODOS: Record<Period, string> = { manha: 'manhã', tarde: 'tarde', noite: 'noite' };
const DIAS: Record<Weekday, string> = { 0: 'segunda', 1: 'terça', 2: 'quarta', 3: 'quinta', 4: 'sexta', 5: 'sábado', 6: 'domingo' };

/** De 0 a 1 para "71%". */
export const porcentagem = (parte: number | null): string => (parte === null ? SEM_NUMERO : `${Math.round(parte * 100)}%`);

export const nomeDoPeriodo = (periodo: Period | null): string => (periodo === null ? SEM_NUMERO : PERIODOS[periodo]);

export const nomeDoDia = (dia: Weekday | null): string => (dia === null ? SEM_NUMERO : DIAS[dia]);
