import { LAGOON_MAX_ANIMATED_ELEMENTS, LAGOON_PROGRESS_ITEMS_MIN_CARE_DAYS, LAGOON_STATE_RULES } from '../config/decisions';
import type { WeekSummary } from './types';

export type ItemDeProgresso = keyof typeof LAGOON_PROGRESS_ITEMS_MIN_CARE_DAYS;
export type ItemDeEstado = 'vagalumes' | 'nuvemDeChuva';
export type ItemDaLagoa = ItemDeProgresso | ItemDeEstado;

/** Momento atual, já resolvido pelo domínio (a lagoa não calcula datas). */
export interface AgoraDaLagoa {
  /** Total de dias de cuidado (todas as semanas). Move os itens de progresso. */
  diasDeCuidadoTotal: number;
  /** O horário atual está dentro do dia do usuário. */
  dentroDoDia: boolean;
  /** Há descanso registrado hoje. */
  descansoHoje: boolean;
}

export interface ItensVisiveis {
  progresso: ItemDeProgresso[];
  estado: ItemDeEstado[];
  todos: ItemDaLagoa[];
  /** Paleta noturna: fora do dia do usuário ou com descanso hoje. */
  noite: boolean;
  /** Semana estável: céu mais claro e sapo na folha maior. */
  estavel: boolean;
}

const ORDEM_PROGRESSO = Object.keys(LAGOON_PROGRESS_ITEMS_MIN_CARE_DAYS) as ItemDeProgresso[];

/** Quais itens aparecem. Função pura. Itens de progresso nunca somem com mais dias de cuidado. */
export function itensVisiveis(resumo: Pick<WeekSummary, 'careDays' | 'stable'>, agora: AgoraDaLagoa): ItensVisiveis {
  const progresso = ORDEM_PROGRESSO.filter((i) => agora.diasDeCuidadoTotal >= LAGOON_PROGRESS_ITEMS_MIN_CARE_DAYS[i]);
  const noite = !agora.dentroDoDia || agora.descansoHoje;
  const estado: ItemDeEstado[] = [];
  if (!agora.dentroDoDia && resumo.careDays >= LAGOON_STATE_RULES.fireflies.minCareDaysInWeek) estado.push('vagalumes');
  if (agora.descansoHoje) estado.push('nuvemDeChuva');
  return { progresso, estado, todos: [...progresso, ...estado], noite, estavel: resumo.stable };
}

export interface PlanoDeAnimacao {
  sapo: number;
  ondinhas: number;
  folhas: number;
  vagalumes: number;
  gotas: number;
  total: number;
}

/** Quantos elementos animados a lagoa liga ao mesmo tempo. Nunca passa de LAGOON_MAX_ANIMATED_ELEMENTS. */
export function planoDeAnimacao(
  itens: Pick<ItensVisiveis, 'todos'>,
  reduzirMovimento: boolean,
  limite: number = LAGOON_MAX_ANIMATED_ELEMENTS,
): PlanoDeAnimacao {
  if (reduzirMovimento) return { sapo: 0, ondinhas: 0, folhas: 0, vagalumes: 0, gotas: 0, total: 0 };
  let sobra = limite;
  const toma = (n: number) => {
    const v = Math.max(0, Math.min(n, sobra));
    sobra -= v;
    return v;
  };
  const sapo = toma(3);
  const ondinhas = toma(2);
  const folhas = toma(itens.todos.includes('folhaVitoriaRegia') ? 2 : 0);
  const gotas = toma(itens.todos.includes('nuvemDeChuva') ? 4 : 0);
  const vagalumes = toma(itens.todos.includes('vagalumes') ? 6 : 0);
  return { sapo, ondinhas, folhas, vagalumes, gotas, total: limite - sobra };
}
