import { METRICAS } from '@pulo/core/config/decisions';
import type { Period, ProfileMetrics, Weekday } from '@pulo/core/domain/types';

import { duracaoTexto } from '../hoje/logic';

/** Sem dado ainda. */
export const SEM_NUMERO = '—';

const PERIODOS: Record<Period, string> = { manha: 'manhã', tarde: 'tarde', noite: 'noite' };
const DIAS: Record<Weekday, string> = { 0: 'segunda', 1: 'terça', 2: 'quarta', 3: 'quinta', 4: 'sexta', 5: 'sábado', 6: 'domingo' };

/** De 0 a 1 para "71%". */
export const porcentagem = (parte: number | null): string => (parte === null ? SEM_NUMERO : `${Math.round(parte * 100)}%`);

export const nomeDoPeriodo = (periodo: Period | null): string => (periodo === null ? SEM_NUMERO : PERIODOS[periodo]);

export const nomeDoDia = (dia: Weekday | null): string => (dia === null ? SEM_NUMERO : DIAS[dia]);

export interface BarraDaComparacao {
  rotulo: string;
  texto: string;
  /** De 0 a 100, em relação à maior. */
  largura: number;
  comDescanso: boolean;
}

/** As duas barras do foco por semana, ou `null` enquanto há pouca história. */
export function comparacaoDoDescanso({ focoMedioSemanaComDescanso: com, focoMedioSemanaSem: sem }: ProfileMetrics['descanso']): BarraDaComparacao[] | null {
  if (com === null || sem === null) return null;
  const maior = Math.max(com, sem, 1);
  const barra = (rotulo: string, minutos: number, comDescanso: boolean): BarraDaComparacao => ({
    rotulo,
    texto: duracaoTexto(minutos),
    largura: Math.round((minutos / maior) * 100),
    comDescanso,
  });
  return [barra('Semanas com descanso', com, true), barra('Semanas sem descanso', sem, false)];
}

export const TEXTO_DE_POUCA_HISTORIA = `A comparação do foco entre semanas com e sem descanso aparece quando houver pelo menos ${METRICAS.minSemanasPorTipo} semanas de cada tipo.`;
