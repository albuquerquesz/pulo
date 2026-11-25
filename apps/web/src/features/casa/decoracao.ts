import { COMODO_INICIAL, comodoDe, verCasa, type ComodoId } from '@pulo/core/domain/casa';
import type { Clock, Repository, RoomDecor } from '@pulo/core/domain/types';

import { escolhaDoId, idDaCompra, precoDe, type Escolha, type Loja } from './catalogo';
import { GUARDADO, lugarDaPosicao, posicaoDoLugar, type Lugar } from './lugares';

/** Um item no quarto: onde está e qual é. */
export interface Colocado {
  lugar: Lugar;
  escolha: Escolha;
}

/** Os registros que estão num cômodo (os guardados incluídos). */
const doComodo = (quarto: readonly RoomDecor[], comodo: ComodoId) => quarto.filter((r) => comodoDe(r) === comodo);

/** O que está no cômodo: um item por lugar, só se o tipo cabe nele. */
export function colocadosNoQuarto(quarto: readonly RoomDecor[], comodo: ComodoId = COMODO_INICIAL): Colocado[] {
  const porLugar = new Map<string, Colocado>();
  for (const registro of doComodo(quarto, comodo)) {
    const escolha = escolhaDoId(registro.item);
    const lugar = lugarDaPosicao(registro);
    if (escolha && lugar && lugar.tipo === escolha.item.tipo) porLugar.set(lugar.id, { lugar, escolha });
  }
  return [...porLugar.values()];
}

const mesma = (a: Escolha, b: Escolha) => a.item.id === b.item.id && a.cor.id === b.cor.id;

function registroDe(quarto: readonly RoomDecor[], escolha: Escolha): RoomDecor | undefined {
  return quarto.find((r) => {
    const outra = escolhaDoId(r.item);
    return outra !== null && mesma(outra, escolha);
  });
}

export const ehMeu = (quarto: readonly RoomDecor[], escolha: Escolha): boolean => registroDe(quarto, escolha) !== undefined;

export type AcaoDaCompra = 'comprar' | 'colocar' | 'no_lugar' | 'ja_e_seu' | 'em_breve';

export interface EstadoDaCompra {
  acao: AcaoDaCompra;
  preco: number;
  /** O botão fica apagado. */
  bloqueado: boolean;
}

export interface PedidoDeCompra {
  quarto: readonly RoomDecor[];
  saldo: number;
  loja: Loja;
  /** `null`: a loja aberta pelo botão de canto, sem lugar escolhido. */
  lugar: Lugar | null;
  escolha: Escolha;
  /** O cômodo que a pessoa está decorando; ausente é o quarto. */
  comodo?: ComodoId;
}

export function estadoDaCompra({ quarto, saldo, loja, lugar, escolha, comodo = COMODO_INICIAL }: PedidoDeCompra): EstadoDaCompra {
  const preco = precoDe(escolha, loja);
  if (ehMeu(quarto, escolha)) {
    if (!lugar) return { acao: 'ja_e_seu', preco, bloqueado: true };
    const aqui = colocadosNoQuarto(quarto, comodo).some((c) => c.lugar.id === lugar.id && mesma(c.escolha, escolha));
    return { acao: aqui ? 'no_lugar' : 'colocar', preco, bloqueado: false };
  }
  if (idDaCompra(escolha, loja) === null) return { acao: 'em_breve', preco, bloqueado: true };
  return { acao: 'comprar', preco, bloqueado: saldo < preco };
}

/** Manda para o guardado o que estiver no lugar. */
export async function tirarDoLugar(repo: Repository, lugar: Lugar, comodo: ComodoId = COMODO_INICIAL): Promise<void> {
  for (const registro of doComodo(await repo.listRoomDecor(), comodo)) {
    if (lugarDaPosicao(registro)?.id === lugar.id) await repo.moveRoomDecor(registro.item, GUARDADO);
  }
}

/**
 * Compra (se ainda não é seu) e coloca no lugar; sem lugar, a compra fica guardada.
 * Um item numa cor é um só: colocar em outro lugar muda ele de lugar, sem pagar de novo.
 * Devolve `false` se não dá (sem saldo ou fora da loja), sem gravar nada.
 */
export async function comprarOuColocar(
  repo: Repository,
  clock: Clock,
  { loja, lugar, escolha, comodo = COMODO_INICIAL }: Pick<PedidoDeCompra, 'loja' | 'lugar' | 'escolha' | 'comodo'>,
): Promise<boolean> {
  const [quarto, casa] = await Promise.all([repo.listRoomDecor(), verCasa(repo)]);
  const compra = estadoDaCompra({ quarto, saldo: casa.saldo, loja, lugar, escolha, comodo });
  if (compra.bloqueado) return false;
  const meu = registroDe(quarto, escolha);
  const destino = { ...(lugar ? posicaoDoLugar(lugar) : GUARDADO), comodo };
  const id = meu?.item ?? idDaCompra(escolha, loja);
  if (id === null) return false;
  // Grava a compra antes de liberar o lugar: se o servidor recusar, o quarto fica como estava.
  if (!meu) await repo.saveRoomDecor({ item: id, cost: compra.preco, createdAt: clock.now(), ...destino });
  if (!lugar) return true;
  for (const registro of doComodo(quarto, comodo)) {
    if (registro.item !== id && lugarDaPosicao(registro)?.id === lugar.id) await repo.moveRoomDecor(registro.item, GUARDADO);
  }
  if (meu) await repo.moveRoomDecor(id, destino);
  return true;
}
