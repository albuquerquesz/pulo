import { CAMADAS_DA_CASA, type CamadaDaCasa, type ComodoId, HOUSE, JOIAS, type ParteDaCasa, type ParteId, ROOM_DECOR, ROOM_GRID } from '../config/decisions';
import {
  type FontesDeJoias,
  type JoiasGanhas,
  joiasGanhas,
  joiasGastas,
  listFreezePurchasesOf,
  saldoDeJoias,
  textoDeFalta,
} from './joias';
import { COMODO_INICIAL, comodoDe, ehComodo } from './comodos';
import { fail, ok, type Result } from './result';
import type { Clock, Purchase, Repository, RoomDecor, RoomRotation, RoomSpot } from './types';

export type { CamadaDaCasa, ComodoId, ParteDaCasa, ParteId };
export { CAMADAS_DA_CASA };
export type DecoracaoId = keyof typeof ROOM_DECOR.itemCost;
export type CorDaDecoracao = keyof typeof ROOM_DECOR.colorCost;

export type HouseErrorCode = 'item_inexistente' | 'ja_comprado' | 'falta_requisito' | 'joias_insuficientes' | 'comodo_nao_comprado';
export type MoveErrorCode = 'item_inexistente' | 'nao_encontrado' | 'corpo_invalido' | 'comodo_nao_comprado';

/** Partes da casa, na ordem em que aparecem. */
export const PARTES: readonly ParteDaCasa[] = HOUSE.parts;

export { COMODOS, COMODO_INICIAL, comodoDe, ehComodo, type ComodoDaCasa } from './comodos';
export const ehParte = (item: string): item is ParteId => Object.hasOwn(HOUSE.partCost, item);

const parteDoCatalogo = (id: ParteId): ParteDaCasa => {
  const parte = PARTES.find((p) => p.id === id);
  if (!parte) throw new RangeError(`parte fora do catálogo: ${id}`);
  return parte;
};

const estaPronta = ({ id, custo }: ParteDaCasa, compradas: ReadonlySet<string>): boolean => custo === 0 || compradas.has(id);

/** Nomes femininos, para o texto concordar. */
const FEMININAS: ReadonlySet<ParteId> = new Set<ParteId>([
  'cozinha', 'sala', 'biblioteca', 'torre', 'chamine', 'varanda', 'arvore', 'cerca', 'horta', 'caixa-correio', 'ponte', 'piscina', 'estufa',
]);

/** "o Quarto" ou "a Cozinha": o artigo que concorda com a parte. */
export const artigoDaParte = (id: ParteId): 'o' | 'a' => (FEMININAS.has(id) ? 'a' : 'o');

/** O motivo de uma parte trancada, como "Precisa do Segundo andar". */
export const textoDoRequisito = (id: ParteId): string => `Precisa d${artigoDaParte(id)} ${parteDoCatalogo(id).nome}`;

export type PodeComprar =
  | { situacao: 'ok' }
  | { situacao: 'ja_tem' }
  | { situacao: 'falta_requisito'; requer: ParteId }
  | { situacao: 'joias_insuficientes'; faltam: number };

/** Se a parte pode ser comprada agora, olhando o que já foi comprado e o saldo. */
export function podeComprar(id: ParteId, compradas: readonly string[], saldo: number): PodeComprar {
  const tem = new Set(compradas);
  const parte = parteDoCatalogo(id);
  if (estaPronta(parte, tem)) return { situacao: 'ja_tem' };
  if (parte.requer && !estaPronta(parteDoCatalogo(parte.requer), tem)) return { situacao: 'falta_requisito', requer: parte.requer };
  if (saldo < parte.custo) return { situacao: 'joias_insuficientes', faltam: parte.custo - saldo };
  return { situacao: 'ok' };
}

export interface ProgressoDaCamada {
  feitas: number;
  total: number;
}

/** Quantas partes de cada camada já estão prontas (as de graça contam). */
export function progressoPorCamada(compradas: readonly string[]): Record<CamadaDaCasa, ProgressoDaCamada> {
  const tem = new Set(compradas);
  const daCamada = (camada: CamadaDaCasa): ProgressoDaCamada => {
    const partes = PARTES.filter((p) => p.camada === camada);
    return { feitas: partes.filter((p) => estaPronta(p, tem)).length, total: partes.length };
  };
  return { comodo: daCamada('comodo'), estrutura: daCamada('estrutura'), exterior: daCamada('exterior') };
}

/** A casa está inteira: todas as partes prontas. Só então o acesso para a próxima ilha abre. */
export function casaCompleta(compradas: readonly string[]): boolean {
  const tem = new Set(compradas);
  return PARTES.every((p) => estaPronta(p, tem));
}

export const DECORACOES: readonly { id: DecoracaoId; nome: string }[] = [
  { id: 'tapete', nome: 'Tapete' },
  { id: 'vaso', nome: 'Vaso de planta' },
  { id: 'luminaria', nome: 'Luminária' },
  { id: 'quadro', nome: 'Quadro' },
  { id: 'estante', nome: 'Estante' },
  { id: 'poltrona', nome: 'Poltrona' },
  { id: 'aquario', nome: 'Aquário' },
  { id: 'relogio', nome: 'Relógio' },
  { id: 'bandeira', nome: 'Bandeirinhas' },
  { id: 'pendente', nome: 'Planta pendurada' },
  { id: 'janela', nome: 'Janela' },
  { id: 'cama', nome: 'Cama' },
  { id: 'sofa', nome: 'Sofá' },
  { id: 'bau', nome: 'Baú' },
  { id: 'pelucia', nome: 'Pelúcia' },
  { id: 'violao', nome: 'Violão' },
];

/** O nome de cada cor, como vai depois do nome do item. */
export const CORES_DA_DECORACAO: Record<CorDaDecoracao, string> = {
  rosa: 'rosa',
  verde: 'verde',
  agua: 'água',
  lilas: 'lilás',
  dourado: 'dourado',
  noite: 'noite',
  brilho: 'brilho',
};

const ehDecoracao = (item: string): item is DecoracaoId => Object.hasOwn(ROOM_DECOR.itemCost, item);
const ehCorDaDecoracao = (cor: string): cor is CorDaDecoracao => Object.hasOwn(ROOM_DECOR.colorCost, cor);

/** Um item da loja do quarto numa cor; `null` é a cor natural. */
export interface DecoracaoLida {
  item: DecoracaoId;
  cor: CorDaDecoracao | null;
}

/** O id gravado de um item numa cor: na natural, só o item; nas outras, `item-cor`. */
export const idDaDecoracao = ({ item, cor }: DecoracaoLida): string => (cor ? `${item}-${cor}` : item);

/** O item e a cor de um id gravado, ou null se a loja não vende esse id. */
export function lerDecoracao(id: string): DecoracaoLida | null {
  if (ehDecoracao(id)) return { item: id, cor: null };
  const [item = '', cor = '', ...resto] = id.split('-');
  if (resto.length > 0 || !ehDecoracao(item) || !ehCorDaDecoracao(cor)) return null;
  return { item, cor };
}

/** O nome de uma decoração na loja, com a cor quando não é a natural. */
function nomeDaDecoracao({ item, cor }: DecoracaoLida): string {
  const nome = DECORACOES.find((d) => d.id === item)?.nome ?? item;
  return cor ? `${nome} ${CORES_DA_DECORACAO[cor]}` : nome;
}

/** Preço da parte da casa, ou null se não existe. */
export const precoDaParte = (item: string): number | null => (ehParte(item) ? HOUSE.partCost[item] : null);
/** Preço da decoração, ou null se não existe. */
export function precoDaDecoracao(id: string): number | null {
  const lida = lerDecoracao(id);
  if (!lida) return null;
  return ROOM_DECOR.itemCost[lida.item] + (lida.cor ? ROOM_DECOR.colorCost[lida.cor] : 0);
}

export const ehRotacao = (valor: number): valor is RoomRotation => ROOM_GRID.rotations.some((r) => r === valor);

/** Se a posição cabe na grade do chão. */
export function posicaoValida({ x, y, rotation }: RoomSpot): boolean {
  const dentro = (v: number, limite: number) => Number.isInteger(v) && v >= 0 && v < limite;
  return dentro(x, ROOM_GRID.columns) && dentro(y, ROOM_GRID.rows) && ehRotacao(rotation);
}

export interface ParteNaCasa extends ParteDaCasa {
  construida: boolean;
  /** O requisito que ainda não está pronto; null se nada tranca a parte. */
  faltaRequisito: ParteId | null;
}

export interface DecoracaoNaLoja {
  /** O id gravado: o item, ou `item-cor` fora da cor natural. */
  id: string;
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
  /** A parte mais barata que falta e já está liberada; null com a casa completa. */
  proxima: ProximaParte | null;
  /** Os cômodos que a pessoa tem. */
  comodos: ComodoId[];
  decoracoes: DecoracaoNaLoja[];
}

/** As partes com o estado de cada uma: a de graça já vem pronta. */
export function partesDaCasa(casa: readonly Purchase[]): ParteNaCasa[] {
  const compradas = new Set(casa.map((c) => c.item));
  return PARTES.map((p) => {
    const trancada = p.requer !== undefined && !estaPronta(parteDoCatalogo(p.requer), compradas);
    const construida = estaPronta(p, compradas);
    return { ...p, construida, faltaRequisito: !construida && trancada ? (p.requer ?? null) : null };
  });
}

/** Os cômodos prontos, na ordem do catálogo. */
export const comodosProntos = (partes: readonly ParteNaCasa[]): ComodoId[] =>
  partes.flatMap((p) => (p.construida && ehComodo(p.id) ? [p.id] : []));

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
  const [barata] = partes.filter((p) => !p.construida && !p.faltaRequisito).sort((a, b) => a.custo - b.custo);
  let proxima: ProximaParte | null = null;
  if (barata) {
    const faltam = Math.max(0, barata.custo - saldo);
    const horasDeFoco = Math.ceil((faltam * JOIAS.focusMinutesPerJoia) / 60);
    proxima = { id: barata.id, nome: barata.nome, custo: barata.custo, faltam, horasDeFoco };
  }
  // Os itens na cor natural, comprados ou não, e os coloridos que a pessoa já comprou.
  const naturais = DECORACOES.map((d) => d.id);
  const coloridos = quarto.flatMap((q) => (lerDecoracao(q.item)?.cor ? [q.item] : []));
  const decoracoes = [...naturais, ...coloridos].flatMap((id): DecoracaoNaLoja[] => {
    const lida = lerDecoracao(id);
    if (!lida) return [];
    const compra = quarto.find((q) => q.item === id);
    return [
      {
        id,
        nome: nomeDaDecoracao(lida),
        custo: precoDaDecoracao(id) ?? 0,
        posicao: compra ? { x: compra.x, y: compra.y, rotation: compra.rotation, comodo: comodoDe(compra) } : null,
      },
    ];
  });
  return { ganhas, gastas, saldo, partes, construidas, total: partes.length, completa: construidas === partes.length, proxima, comodos: comodosProntos(partes), decoracoes };
}

function pagar(preco: number, saldo: number): Result<number, HouseErrorCode> {
  if (saldo < preco) return fail('joias_insuficientes', textoDeFalta(preco - saldo));
  return ok(preco);
}

/** Se dá para construir a parte agora. O servidor usa a mesma regra antes de gravar. */
export function validarCompraDaParte(item: string, estado: EstadoDaCasa): Result<number, HouseErrorCode> {
  if (!ehParte(item)) return fail('item_inexistente', 'Essa parte da casa não existe.');
  const compradas = estado.partes.filter((p) => p.construida).map((p) => p.id);
  const pode = podeComprar(item, compradas, estado.saldo);
  if (pode.situacao === 'ja_tem') return fail('ja_comprado', 'Essa parte da casa já está pronta.');
  if (pode.situacao === 'falta_requisito') return fail('falta_requisito', `${textoDoRequisito(pode.requer)}.`);
  if (pode.situacao === 'joias_insuficientes') return fail('joias_insuficientes', textoDeFalta(pode.faltam));
  return ok(HOUSE.partCost[item]);
}

const semComodo = () => fail('comodo_nao_comprado', 'Construa esse cômodo antes de decorar.');

/** Se dá para comprar a decoração agora, no cômodo pedido. O servidor usa a mesma regra antes de gravar. */
export function validarCompraDaDecoracao(
  item: string,
  estado: EstadoDaCasa,
  comodo: ComodoId = COMODO_INICIAL,
): Result<number, HouseErrorCode> {
  const custo = precoDaDecoracao(item);
  if (custo === null) return fail('item_inexistente', 'Esse item não existe na loja.');
  if (estado.decoracoes.some((d) => d.id === item && d.posicao)) return fail('ja_comprado', 'Esse item já é seu.');
  if (!estado.comodos.includes(comodo)) return semComodo();
  if (estado.saldo < custo) return fail('joias_insuficientes', textoDeFalta(custo - estado.saldo));
  return ok(custo);
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
  const preco = validarCompraDaDecoracao(item, await verCasa(repo), comodoDe(spot));
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
  if (spot.comodo && !comodosProntos(partesDaCasa(await repo.listHousePurchases())).includes(spot.comodo)) return semComodo();
  await repo.moveRoomDecor(item, spot);
  return ok(await verCasa(repo));
}
