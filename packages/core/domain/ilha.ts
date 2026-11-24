import { ISLAND } from '../config/decisions';
import { sessionCountsAsCare } from './care-days';
import { fail, ok, type Result } from './result';
import type { Clock, FocusSession, Goal, HabitLog, IslandPurchase, Repository, RestDay } from './types';

export type AreaId = keyof typeof ISLAND.areaCost;
export type EnfeiteId = keyof typeof ISLAND.decorCost;
export type ItemDaIlha = AreaId | EnfeiteId;

export type IslandErrorCode = 'item_inexistente' | 'ja_comprado' | 'area_fechada' | 'fora_de_ordem' | 'moscas_insuficientes';

export interface Enfeite {
  id: EnfeiteId;
  nome: string;
}

export interface Area {
  id: AreaId;
  nome: string;
  /** Uma frase sobre o lugar, mostrada no mapa. */
  descricao: string;
  enfeites: readonly Enfeite[];
}

/** O mapa, na ordem em que as áreas abrem. */
export const AREAS: readonly Area[] = [
  {
    id: 'lagoa',
    nome: 'Lagoa',
    descricao: 'Onde tudo começa.',
    enfeites: [
      { id: 'banco', nome: 'Banquinho' },
      { id: 'lanterna', nome: 'Lanterna' },
      { id: 'ponte', nome: 'Ponte' },
    ],
  },
  {
    id: 'praia',
    nome: 'Praia',
    descricao: 'Areia quente e ondas calmas.',
    enfeites: [
      { id: 'guardaSol', nome: 'Guarda sol' },
      { id: 'castelo', nome: 'Castelo de areia' },
      { id: 'barco', nome: 'Barquinho' },
    ],
  },
  {
    id: 'bosque',
    nome: 'Bosque',
    descricao: 'Sombra fresca para descansar.',
    enfeites: [
      { id: 'cogumelos', nome: 'Cogumelos' },
      { id: 'balanco', nome: 'Balanço' },
      { id: 'casaNaArvore', nome: 'Casa na árvore' },
    ],
  },
  {
    id: 'cachoeira',
    nome: 'Cachoeira',
    descricao: 'Água que não para de cantar.',
    enfeites: [
      { id: 'arcoIris', nome: 'Arco íris' },
      { id: 'pedras', nome: 'Pedras de pular' },
      { id: 'deck', nome: 'Deck' },
    ],
  },
  {
    id: 'farol',
    nome: 'Farol',
    descricao: 'Lá de cima dá para ver a ilha toda.',
    enfeites: [
      { id: 'bandeirinhas', nome: 'Bandeirinhas' },
      { id: 'telescopio', nome: 'Telescópio' },
      { id: 'fogueira', nome: 'Fogueira' },
    ],
  },
];

const ehArea = (item: string): item is AreaId => Object.hasOwn(ISLAND.areaCost, item);
const ehEnfeite = (item: string): item is EnfeiteId => Object.hasOwn(ISLAND.decorCost, item);

/** Preço do item no catálogo, ou null se o item não existe. */
export function precoDoItem(item: string): number | null {
  if (ehArea(item)) return ISLAND.areaCost[item];
  if (ehEnfeite(item)) return ISLAND.decorCost[item];
  return null;
}

/** O que gera moscas. Tudo vem dos registros que o app já guarda. */
export interface FontesDeMoscas {
  habitLogs: readonly HabitLog[];
  sessions: readonly FocusSession[];
  restDays: readonly RestDay[];
  goals: readonly Goal[];
}

export interface MoscasGanhas {
  habitos: number;
  focos: number;
  descansos: number;
  marcos: number;
  metas: number;
  total: number;
}

/** Moscas ganhas desde sempre. Calculado, nunca gravado: desmarcar um hábito devolve a mosca. */
export function moscasGanhas(fontes: FontesDeMoscas): MoscasGanhas {
  const por = ISLAND.fliesPer;
  const habitos = fontes.habitLogs.length * por.habitDone;
  const focos = fontes.sessions.filter(sessionCountsAsCare).length * por.careSession;
  const descansos = fontes.restDays.length * por.restDay;
  const marcos = fontes.goals.reduce((n, g) => n + g.milestones.filter((m) => m.doneAt !== undefined).length, 0) * por.milestoneDone;
  const metas = fontes.goals.filter((g) => g.state === 'concluida').length * por.goalCompleted;
  return { habitos, focos, descansos, marcos, metas, total: habitos + focos + descansos + marcos + metas };
}

export type EstadoDaArea = 'aberta' | 'proxima' | 'fechada';

export interface AreaNoMapa extends Area {
  custo: number;
  estado: EstadoDaArea;
  enfeitesNoMapa: (Enfeite & { custo: number; comprado: boolean })[];
}

export interface EstadoDaIlha {
  ganhas: MoscasGanhas;
  gastas: number;
  /** Nunca negativo (se a pessoa desmarcar hábitos depois de comprar, fica em zero). */
  saldo: number;
  /** Quantas áreas estão abertas (1 a AREAS.length). */
  nivel: number;
  areas: AreaNoMapa[];
}

/** O mapa inteiro, a partir dos registros e das compras. Função pura. */
export function estadoDaIlha(fontes: FontesDeMoscas, compras: readonly IslandPurchase[]): EstadoDaIlha {
  const ganhas = moscasGanhas(fontes);
  const gastas = compras.reduce((n, c) => n + c.cost, 0);
  const comprado = new Set(compras.map((c) => c.item));
  const aberta = (a: Area, i: number) => i === 0 || comprado.has(a.id);
  const nivel = AREAS.filter(aberta).length;
  const areas = AREAS.map((a, i): AreaNoMapa => {
    const estado: EstadoDaArea = aberta(a, i) ? 'aberta' : i === nivel ? 'proxima' : 'fechada';
    return {
      ...a,
      custo: ISLAND.areaCost[a.id],
      estado,
      enfeitesNoMapa: a.enfeites.map((e) => ({ ...e, custo: ISLAND.decorCost[e.id], comprado: comprado.has(e.id) })),
    };
  });
  return { ganhas, gastas, saldo: Math.max(0, ganhas.total - gastas), nivel, areas };
}

/** Se dá para comprar o item agora. O servidor usa a mesma regra antes de gravar. */
export function validarCompra(item: string, estado: EstadoDaIlha): Result<number, IslandErrorCode> {
  const preco = precoDoItem(item);
  if (preco === null) return fail('item_inexistente', 'Esse item não existe na ilha.');
  if (ehArea(item)) {
    const area = estado.areas.find((a) => a.id === item);
    if (area?.estado === 'aberta') return fail('ja_comprado', 'Essa área já está aberta.');
    if (area?.estado !== 'proxima') return fail('fora_de_ordem', 'Abra as áreas na ordem do mapa.');
  } else {
    const area = estado.areas.find((a) => a.enfeites.some((e) => e.id === item));
    if (area?.enfeitesNoMapa.some((e) => e.id === item && e.comprado)) return fail('ja_comprado', 'Esse enfeite já é seu.');
    if (area?.estado !== 'aberta') return fail('area_fechada', 'Abra a área antes de enfeitar.');
  }
  if (estado.saldo < preco) return fail('moscas_insuficientes', `Faltam ${preco - estado.saldo} moscas.`);
  return ok(preco);
}

async function lerIlha(repo: Repository): Promise<EstadoDaIlha> {
  const [habitLogs, sessions, restDays, goals, compras] = await Promise.all([
    repo.listHabitLogs(),
    repo.listSessions(),
    repo.listRestDays(),
    repo.listGoals(),
    repo.listIslandPurchases(),
  ]);
  return estadoDaIlha({ habitLogs, sessions, restDays, goals }, compras);
}

/** Estado atual da ilha, lido do repositório. */
export function verIlha(repo: Repository): Promise<EstadoDaIlha> {
  return lerIlha(repo);
}

/** Compra uma área ou um enfeite com moscas. */
export async function comprarNaIlha(repo: Repository, clock: Clock, item: string): Promise<Result<EstadoDaIlha, IslandErrorCode>> {
  const antes = await lerIlha(repo);
  const preco = validarCompra(item, antes);
  if (!preco.ok) return preco;
  await repo.saveIslandPurchase({ item, cost: preco.value, createdAt: clock.now() });
  return ok(await lerIlha(repo));
}
