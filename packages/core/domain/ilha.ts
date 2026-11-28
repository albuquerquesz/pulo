/**
 * Ilha antiga (spec 12), em modo legado: continua valendo para a tela atual até a casa (spec 18, `casa.ts`) tomar o lugar.
 * O saldo daqui desconta as compras antigas e as novas; o da casa não desconta as antigas (as joias voltam).
 */
import { ISLAND } from '../config/decisions';
import { type FontesDeJoias, type JoiasGanhas, joiasGanhas, joiasGastas, saldoDeJoias, textoDeFalta, listFreezePurchasesOf, joiasForaDaJanelaDe } from './joias';
import { fail, ok, type Result } from './result';
import type { Clock, IslandPurchase, Purchase, Repository } from './types';

export type AreaId = keyof typeof ISLAND.areaCost;
export type EnfeiteId = keyof typeof ISLAND.decorCost;
export type ItemDaIlha = AreaId | EnfeiteId;

export type IslandErrorCode = 'item_inexistente' | 'ja_comprado' | 'area_fechada' | 'fora_de_ordem' | 'joias_insuficientes';

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

export type EstadoDaArea = 'aberta' | 'proxima' | 'fechada';

export interface AreaNoMapa extends Area {
  custo: number;
  estado: EstadoDaArea;
  enfeitesNoMapa: (Enfeite & { custo: number; comprado: boolean })[];
}

export interface EstadoDaIlha {
  ganhas: JoiasGanhas;
  gastas: number;
  /** Nunca negativo (se a pessoa desmarcar hábitos depois de comprar, fica em zero). */
  saldo: number;
  /** Quantas áreas estão abertas (1 a AREAS.length). */
  nivel: number;
  areas: AreaNoMapa[];
}

/** O mapa inteiro, a partir dos registros e das compras. Função pura. */
export function estadoDaIlha(
  fontes: FontesDeJoias,
  compras: readonly IslandPurchase[],
  comprasNovas: readonly Purchase[] = [],
): EstadoDaIlha {
  const ganhas = joiasGanhas(fontes);
  const gastas = joiasGastas(compras) + joiasGastas(comprasNovas);
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
  return { ganhas, gastas, saldo: saldoDeJoias(ganhas.total, gastas), nivel, areas };
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
  if (estado.saldo < preco) return fail('joias_insuficientes', textoDeFalta(preco - estado.saldo));
  return ok(preco);
}

async function lerIlha(repo: Repository): Promise<EstadoDaIlha> {
  const [habitLogs, sessions, restDays, goals, baus, credito, compras, casa, quarto, gelos, foraDaJanela] = await Promise.all([
    repo.listHabitLogs(),
    repo.listSessions(),
    repo.listRestDays(),
    repo.listGoals(),
    repo.listGoalChests(),
    repo.getJoiaCredit(),
    repo.listIslandPurchases(),
    repo.listHousePurchases(),
    repo.listRoomDecor(),
    listFreezePurchasesOf(repo),
    joiasForaDaJanelaDe(repo),
  ]);
  return estadoDaIlha({ habitLogs, sessions, restDays, goals, baus, credito, foraDaJanela }, compras, [...casa, ...quarto, ...gelos]);
}

/** Estado atual da ilha, lido do repositório. */
export function verIlha(repo: Repository): Promise<EstadoDaIlha> {
  return lerIlha(repo);
}

/** Compra uma área ou um enfeite com joias. */
export async function comprarNaIlha(repo: Repository, clock: Clock, item: string): Promise<Result<EstadoDaIlha, IslandErrorCode>> {
  const antes = await lerIlha(repo);
  const preco = validarCompra(item, antes);
  if (!preco.ok) return preco;
  await repo.saveIslandPurchase({ item, cost: preco.value, createdAt: clock.now() });
  return ok(await lerIlha(repo));
}
