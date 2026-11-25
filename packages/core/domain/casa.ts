import { HOUSE, JOIAS, ROOM_DECOR, ROOM_GRID } from '../config/decisions';
import {
  type FontesDeJoias,
  type JoiasGanhas,
  joiasGanhas,
  joiasGastas,
  listFreezePurchasesOf,
  saldoDeJoias,
  textoDeFalta,
} from './joias';
import { fail, ok, type Result } from './result';
import type { Clock, Purchase, Repository, RoomDecor, RoomRotation, RoomSpot } from './types';

export type ParteId = keyof typeof HOUSE.partCost;
export type DecoracaoId = keyof typeof ROOM_DECOR.itemCost;

export type HouseErrorCode = 'item_inexistente' | 'ja_comprado' | 'joias_insuficientes';
export type MoveErrorCode = 'item_inexistente' | 'nao_encontrado' | 'corpo_invalido';

/** Partes da casa, na ordem em que aparecem. */
export const PARTES: readonly { id: ParteId; nome: string }[] = [
  { id: 'quarto', nome: 'Quarto' },
  { id: 'cozinha', nome: 'Cozinha' },
  { id: 'varanda', nome: 'Varanda' },
  { id: 'jardim', nome: 'Jardim' },
  { id: 'arvore', nome: 'Árvore' },
  { id: 'cerca', nome: 'Cerca' },
];

export const DECORACOES: readonly { id: DecoracaoId; nome: string }[] = [
  { id: 'tapete', nome: 'Tapete' },
  { id: 'vaso', nome: 'Vaso de planta' },
  { id: 'luminaria', nome: 'Luminária' },
  { id: 'quadro', nome: 'Quadro' },
  { id: 'estante', nome: 'Estante' },
  { id: 'poltrona', nome: 'Poltrona' },
  { id: 'aquario', nome: 'Aquário' },
];

const ehParte = (item: string): item is ParteId => Object.hasOwn(HOUSE.partCost, item);
const ehDecoracao = (item: string): item is DecoracaoId => Object.hasOwn(ROOM_DECOR.itemCost, item);

/** Preço da parte da casa, ou null se não existe. */
export const precoDaParte = (item: string): number | null => (ehParte(item) ? HOUSE.partCost[item] : null);
/** Preço da decoração, ou null se não existe. */
export const precoDaDecoracao = (item: string): number | null => (ehDecoracao(item) ? ROOM_DECOR.itemCost[item] : null);

export const ehRotacao = (valor: number): valor is RoomRotation => ROOM_GRID.rotations.some((r) => r === valor);

/** Se a posição cabe na grade do chão. */
export function posicaoValida({ x, y, rotation }: RoomSpot): boolean {
  const dentro = (v: number, limite: number) => Number.isInteger(v) && v >= 0 && v < limite;
  return dentro(x, ROOM_GRID.columns) && dentro(y, ROOM_GRID.rows) && ehRotacao(rotation);
}

export interface ParteNaCasa {
  id: ParteId;
  nome: string;
  custo: number;
  construida: boolean;
}

export interface DecoracaoNaLoja {
  id: DecoracaoId;
  nome: string;
  custo: number;
  /** Onde está no quarto; null se ainda não foi comprada. */
  posicao: RoomSpot | null;
}

export interface ProximaParte {
  id: ParteId;
  nome: string;
  custo: number;
  /** Joias que ainda faltam (0 se já dá para construir). */
  faltam: number;
  /** Horas de foco (arredondadas para cima) que rendem o que falta. */
  horasDeFoco: number;
}

export interface EstadoDaCasa {
  ganhas: JoiasGanhas;
  gastas: number;
  saldo: number;
  partes: ParteNaCasa[];
  construidas: number;
  total: number;
  completa: boolean;
  /** A parte mais barata que falta; null com a casa completa. */
  proxima: ProximaParte | null;
  decoracoes: DecoracaoNaLoja[];
}

/** As partes com o estado de cada uma: a de graça já vem pronta. */
export function partesDaCasa(casa: readonly Purchase[]): ParteNaCasa[] {
  const compradas = new Set(casa.map((c) => c.item));
  return PARTES.map((p) => {
    const custo = HOUSE.partCost[p.id];
    return { ...p, custo, construida: custo === 0 || compradas.has(p.id) };
  });
}

/** A casa e o quarto, a partir dos registros e das compras. Função pura. */
export function estadoDaCasa(
  fontes: FontesDeJoias,
  casa: readonly Purchase[],
  quarto: readonly RoomDecor[],
  gelos: readonly Purchase[] = [],
): EstadoDaCasa {
  const ganhas = joiasGanhas(fontes);
  const gastas = joiasGastas(casa) + joiasGastas(quarto) + joiasGastas(gelos);
  const saldo = saldoDeJoias(ganhas.total, gastas);
  const partes = partesDaCasa(casa);
  const construidas = partes.filter((p) => p.construida).length;
  const [barata] = partes.filter((p) => !p.construida).sort((a, b) => a.custo - b.custo);
  let proxima: ProximaParte | null = null;
  if (barata) {
    const faltam = Math.max(0, barata.custo - saldo);
    const horasDeFoco = Math.ceil((faltam * JOIAS.focusMinutesPerJoia) / 60);
    proxima = { id: barata.id, nome: barata.nome, custo: barata.custo, faltam, horasDeFoco };
  }
  const decoracoes = DECORACOES.map((d): DecoracaoNaLoja => {
    const compra = quarto.find((q) => q.item === d.id);
    return {
      ...d,
      custo: ROOM_DECOR.itemCost[d.id],
      posicao: compra ? { x: compra.x, y: compra.y, rotation: compra.rotation } : null,
    };
  });
  return { ganhas, gastas, saldo, partes, construidas, total: partes.length, completa: construidas === partes.length, proxima, decoracoes };
}

function pagar(preco: number, saldo: number): Result<number, HouseErrorCode> {
  if (saldo < preco) return fail('joias_insuficientes', textoDeFalta(preco - saldo));
  return ok(preco);
}

/** Se dá para construir a parte agora. O servidor usa a mesma regra antes de gravar. */
export function validarCompraDaParte(item: string, estado: EstadoDaCasa): Result<number, HouseErrorCode> {
  const parte = estado.partes.find((p) => p.id === item);
  if (!parte) return fail('item_inexistente', 'Essa parte da casa não existe.');
  if (parte.construida) return fail('ja_comprado', 'Essa parte da casa já está pronta.');
  return pagar(parte.custo, estado.saldo);
}

/** Se dá para comprar a decoração agora. O servidor usa a mesma regra antes de gravar. */
export function validarCompraDaDecoracao(item: string, estado: EstadoDaCasa): Result<number, HouseErrorCode> {
  const decoracao = estado.decoracoes.find((d) => d.id === item);
  if (!decoracao) return fail('item_inexistente', 'Esse item não existe na loja.');
  if (decoracao.posicao) return fail('ja_comprado', 'Esse item já é seu.');
  return pagar(decoracao.custo, estado.saldo);
}

/** Estado atual da casa, lido do repositório. */
export async function verCasa(repo: Repository): Promise<EstadoDaCasa> {
  const [habitLogs, sessions, restDays, goals, baus, credito, casa, quarto, gelos] = await Promise.all([
    repo.listHabitLogs(),
    repo.listSessions(),
    repo.listRestDays(),
    repo.listGoals(),
    repo.listGoalChests(),
    repo.getJoiaCredit(),
    repo.listHousePurchases(),
    repo.listRoomDecor(),
    listFreezePurchasesOf(repo),
  ]);
  return estadoDaCasa({ habitLogs, sessions, restDays, goals, baus, credito }, casa, quarto, gelos);
}

/** Constrói uma parte da casa com joias. */
export async function comprarParte(repo: Repository, clock: Clock, item: string): Promise<Result<EstadoDaCasa, HouseErrorCode>> {
  const preco = validarCompraDaParte(item, await verCasa(repo));
  if (!preco.ok) return preco;
  await repo.saveHousePurchase({ item, cost: preco.value, createdAt: clock.now() });
  return ok(await verCasa(repo));
}

/** Compra uma decoração e já a coloca no quarto. A posição precisa caber na grade (`posicaoValida`). */
export async function comprarDecoracao(
  repo: Repository,
  clock: Clock,
  item: string,
  spot: RoomSpot,
): Promise<Result<EstadoDaCasa, HouseErrorCode | 'corpo_invalido'>> {
  if (!posicaoValida(spot)) return fail('corpo_invalido', 'Essa posição não cabe no quarto.');
  const preco = validarCompraDaDecoracao(item, await verCasa(repo));
  if (!preco.ok) return preco;
  await repo.saveRoomDecor({ item, cost: preco.value, createdAt: clock.now(), ...spot });
  return ok(await verCasa(repo));
}

/** Muda de lugar uma decoração já comprada, sem custo. */
export async function moverDecoracao(repo: Repository, item: string, spot: RoomSpot): Promise<Result<EstadoDaCasa, MoveErrorCode>> {
  if (precoDaDecoracao(item) === null) return fail('item_inexistente', 'Esse item não existe na loja.');
  if (!posicaoValida(spot)) return fail('corpo_invalido', 'Essa posição não cabe no quarto.');
  const quarto = await repo.listRoomDecor();
  if (!quarto.some((d) => d.item === item)) return fail('nao_encontrado', 'Compre esse item antes de mudar ele de lugar.');
  await repo.moveRoomDecor(item, spot);
  return ok(await verCasa(repo));
}
