import { COMODO_INICIAL, comodoDe, verCasa, type ComodoId } from '@pulo/core/domain/casa';
import type { Clock, Repository, RoomDecor } from '@pulo/core/domain/types';

import { escolhaDoId, idDaCompra, precoDe, type Escolha } from './catalogo';
import { GUARDADO, lugarDaPosicao, posicaoDoLugar } from './lugares';
import type { LugarId, Movel } from './mobilia';

/** Os registros que estão num cômodo (os guardados incluídos). */
const doComodo = (quarto: readonly RoomDecor[], comodo: ComodoId) => quarto.filter((r) => comodoDe(r) === comodo);

/** A escolha que o registro mostra no quarto; `null` se está guardado ou não é mais vendido. */
function noLugar(registro: RoomDecor): Escolha | null {
  const escolha = escolhaDoId(registro.item);
  return escolha && lugarDaPosicao(registro)?.id === escolha.lugar.id ? escolha : null;
}

/** O móvel de cada lugar ocupado. */
export type Colocados = ReadonlyMap<LugarId, Escolha>;

/** O que está no cômodo: um móvel por lugar. */
export function colocadosNoQuarto(quarto: readonly RoomDecor[], comodo: ComodoId = COMODO_INICIAL): Colocados {
  const porLugar = new Map<LugarId, Escolha>();
  for (const registro of doComodo(quarto, comodo)) {
    const escolha = noLugar(registro);
    if (escolha) porLugar.set(escolha.lugar.id, escolha);
  }
  return porLugar;
}

const registroDe = (quarto: readonly RoomDecor[], escolha: Escolha) => quarto.find((r) => r.item === idDaCompra(escolha));

export const ehMeu = (quarto: readonly RoomDecor[], escolha: Escolha): boolean => registroDe(quarto, escolha) !== undefined;

/** O outro cômodo onde o item está colocado; `null` se está aqui, guardado ou não é seu. */
export function emOutroComodo(quarto: readonly RoomDecor[], escolha: Escolha, comodo: ComodoId): ComodoId | null {
  const registro = registroDe(quarto, escolha);
  if (!registro || !noLugar(registro)) return null;
  const onde = comodoDe(registro);
  return onde === comodo ? null : onde;
}

export type AcaoDaCompra = 'comprar' | 'colocar' | 'no_lugar';

export interface EstadoDaCompra {
  acao: AcaoDaCompra;
  preco: number;
  /** O botão fica apagado. */
  bloqueado: boolean;
}

export interface PedidoDeCompra {
  quarto: readonly RoomDecor[];
  saldo: number;
  escolha: Escolha;
  /** O cômodo que a pessoa está decorando; ausente é o quarto. */
  comodo?: ComodoId;
}

export function estadoDaCompra({ quarto, saldo, escolha, comodo = COMODO_INICIAL }: PedidoDeCompra): EstadoDaCompra {
  const preco = precoDe(escolha);
  if (!ehMeu(quarto, escolha)) return { acao: 'comprar', preco, bloqueado: saldo < preco };
  const atual = colocadosNoQuarto(quarto, comodo).get(escolha.lugar.id);
  const aqui = atual !== undefined && idDaCompra(atual) === idDaCompra(escolha);
  return { acao: aqui ? 'no_lugar' : 'colocar', preco, bloqueado: aqui };
}

/**
 * Manda para o guardado o que estiver no lugar, menos `fica`. Os itens que a loja não vende mais ficam como estão:
 * a API recusa mudar eles de lugar.
 */
async function liberar(repo: Repository, quarto: readonly RoomDecor[], lugar: Movel, comodo: ComodoId, fica?: string): Promise<void> {
  for (const registro of doComodo(quarto, comodo)) {
    if (registro.item !== fica && noLugar(registro)?.lugar.id === lugar.id) await repo.moveRoomDecor(registro.item, { ...GUARDADO });
  }
}

export async function tirarDoLugar(repo: Repository, lugar: Movel, comodo: ComodoId = COMODO_INICIAL): Promise<void> {
  await liberar(repo, await repo.listRoomDecor(), lugar, comodo);
}

/**
 * Compra (se ainda não é seu) e coloca no lugar dele; o que estava lá vai para o guardado.
 * Um modelo numa cor é um só: colocar em outro cômodo muda ele de lugar, sem pagar de novo.
 * Devolve `false` se não dá (sem saldo ou já no lugar), sem gravar nada.
 */
export async function comprarOuColocar(
  repo: Repository,
  clock: Clock,
  { escolha, comodo = COMODO_INICIAL }: Pick<PedidoDeCompra, 'escolha' | 'comodo'>,
): Promise<boolean> {
  const [quarto, casa] = await Promise.all([repo.listRoomDecor(), verCasa(repo)]);
  const compra = estadoDaCompra({ quarto, saldo: casa.saldo, escolha, comodo });
  if (compra.bloqueado) return false;
  const meu = registroDe(quarto, escolha);
  const destino = { ...posicaoDoLugar(escolha.lugar), comodo };
  const id = idDaCompra(escolha);
  // Grava a compra antes de liberar o lugar: se o servidor recusar, o quarto fica como estava.
  if (!meu) await repo.saveRoomDecor({ item: id, cost: compra.preco, createdAt: clock.now(), ...destino });
  await liberar(repo, quarto, escolha.lugar, comodo, id);
  if (meu) await repo.moveRoomDecor(id, destino);
  return true;
}
