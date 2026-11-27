import { ROOM_GRID } from '@pulo/core/config/decisions';
import { fixedClock } from '@pulo/core/domain/clock';
import { sp } from '@pulo/core/domain/test-utils';
import type { Habit, RoomDecor } from '@pulo/core/domain/types';

import { createMemoryRepository } from '@/data';

import { COR_NATURAL, CORES, escolhaDoId, idDaCompra, ITENS, precoDe, type Escolha } from './catalogo';
import { colocadosNoQuarto, comprarOuColocar, estadoDaCompra, tirarDoLugar } from './decoracao';
import { ajustarMinutos, joiasEstimadas, opcoesDeVinculo, preenchimento } from './logic';
import { GUARDADO, lugarDaPosicao, LUGARES, posicaoDoLugar } from './lugares';

const MIN = 60_000;

/** A escolha de um registro, pelo id que a API vende. */
function escolha(id: string): Escolha {
  const encontrada = escolhaDoId(id);
  if (!encontrada) throw new Error(`sem item ${id}`);
  return encontrada;
}

/** Qualquer item do catálogo numa cor, vendido ou não. */
function item(id: string, cor = COR_NATURAL.id): Escolha {
  const achado = ITENS.find((i) => i.id === id);
  const tinta = CORES.find((c) => c.id === cor);
  if (!achado || !tinta) throw new Error(`sem item ${id}`);
  return { item: achado, cor: tinta };
}
const [parede, outraParede] = LUGARES;
const chao = LUGARES[4];

async function comJoias(joias: number) {
  const repo = createMemoryRepository();
  const clock = fixedClock(sp(2026, 11, 23, 10, 0));
  for (let i = 0; i < joias; i += 1) await repo.saveHabitLog({ habitId: 'h', date: `2026-10-${i}`, doneAt: i });
  return { repo, clock };
}

describe('timer', () => {
  test('os minutos ficam entre 15 e 50, de 5 em 5', () => {
    expect([1, 15, 23, 27, 50, 90].map(ajustarMinutos)).toEqual([15, 15, 25, 25, 50, 50]);
    expect(preenchimento(15)).toBe(0);
    expect(preenchimento(50)).toBe(100);
  });

  test('uma joia a cada 5 minutos focados, até o planejado', () => {
    const sessao = { id: 's', startedAt: 0, plannedMinutes: 25, state: 'em_andamento', pausedMs: 0 } as const;
    expect([4, 5, 24, 25, 60].map((m) => joiasEstimadas(sessao, m * MIN))).toEqual([0, 1, 4, 5, 5]);
  });
});

describe('Para', () => {
  const habito = (id: string): Habit => ({ id, title: id, weekdays: [0], state: 'ativo' });
  const alvos = { habitos: [habito('a'), habito('b'), habito('c')], pendentes: [habito('a'), habito('b'), habito('c')], metas: [], tarefas: [] };

  test('o alvo da URL vem primeiro, sem repetir, e Livre por último', () => {
    expect(opcoesDeVinculo({ habito: 'c' }, alvos).map((o) => o.chave)).toEqual(['habito:c', 'habito:a', 'habito:b', 'livre']);
    expect(opcoesDeVinculo({ habito: 'a' }, alvos).map((o) => o.chave)).toEqual(['habito:a', 'habito:b', 'livre']);
  });

  test('alvo que não existe é ignorado', () => {
    expect(opcoesDeVinculo({ meta: 'sumiu' }, { ...alvos, pendentes: [] }).map((o) => o.chave)).toEqual(['livre']);
  });
});

describe('lugares e catálogo', () => {
  test('cada lugar tem uma casa própria da grade, e o guardado não é lugar', () => {
    for (const lugar of LUGARES) expect(lugarDaPosicao(posicaoDoLugar(lugar))).toBe(lugar);
    expect(LUGARES.length).toBeLessThan(ROOM_GRID.columns * ROOM_GRID.rows);
    expect(lugarDaPosicao(GUARDADO)).toBeNull();
  });

  test('todo item se compra em toda cor, com o preço de ROOM_DECOR', () => {
    expect(idDaCompra(escolha('quadro'))).toBe('quadro');
    expect(precoDe(escolha('quadro'))).toBe(30);
    expect(idDaCompra(item('quadro', 'rosa'))).toBe('quadro-rosa');
    expect(idDaCompra(item('cama'))).toBe('cama');
    expect(idDaCompra(item('planta', 'agua'))).toBe('vaso-agua');
  });

  test('a cor Brilho custa mais que o item na cor natural', () => {
    expect(precoDe(item('cama'))).toBe(60);
    expect(precoDe(item('cama', 'brilho'))).toBe(70);
  });

  test('todo item em toda cor volta do id gravado', () => {
    for (const vendido of ITENS) {
      for (const cor of CORES) expect(escolhaDoId(idDaCompra({ item: vendido, cor }))).toEqual({ item: vendido, cor });
    }
    expect(escolhaDoId('cama-roxo')).toBeNull();
  });

  test('item em lugar de outro tipo não aparece', () => {
    const registro: RoomDecor = { item: 'poltrona', cost: 60, createdAt: 1, ...posicaoDoLugar(parede) };
    expect(colocadosNoQuarto([registro])).toEqual([]);
  });
});

describe('compra', () => {
  test('sem saldo o botão apaga e nada é gravado', async () => {
    const { repo, clock } = await comJoias(10);
    const pedido = { lugar: parede, escolha: escolha('quadro') } as const;
    expect(estadoDaCompra({ ...pedido, quarto: [], saldo: 10 })).toMatchObject({ acao: 'comprar', bloqueado: true });
    expect(await comprarOuColocar(repo, clock, pedido)).toBe(false);
    expect(await repo.listRoomDecor()).toEqual([]);
  });

  test('comprar grava, mover é de graça e o antigo do lugar vai para o guardado', async () => {
    const { repo, clock } = await comJoias(80);
    const quadro = { escolha: escolha('quadro') } as const;
    expect(await comprarOuColocar(repo, clock, { ...quadro, lugar: parede })).toBe(true);
    expect(await comprarOuColocar(repo, clock, { ...quadro, lugar: outraParede })).toBe(true);
    expect(await repo.listRoomDecor()).toHaveLength(1);
    expect(colocadosNoQuarto(await repo.listRoomDecor()).map((c) => c.lugar.id)).toEqual([outraParede.id]);

    await comprarOuColocar(repo, clock, { escolha: escolha('estante'), lugar: outraParede });
    const quarto = await repo.listRoomDecor();
    expect(quarto.map((d) => d.cost)).toEqual([30, 45]);
    expect(colocadosNoQuarto(quarto).map((c) => c.escolha.item.id)).toEqual(['prateleira']);

    await tirarDoLugar(repo, outraParede);
    expect(colocadosNoQuarto(await repo.listRoomDecor())).toEqual([]);
    expect(await repo.listRoomDecor()).toHaveLength(2);
  });

  test('cada cômodo mostra e libera só a decoração dele', async () => {
    const { repo, clock } = await comJoias(80);
    const quadro = { escolha: escolha('quadro'), lugar: parede } as const;
    const estante = { escolha: escolha('estante'), lugar: parede, comodo: 'cozinha' } as const;
    await comprarOuColocar(repo, clock, quadro);
    await comprarOuColocar(repo, clock, estante);
    const quarto = await repo.listRoomDecor();
    expect(colocadosNoQuarto(quarto).map((c) => c.escolha.item.id)).toEqual(['quadro']);
    expect(colocadosNoQuarto(quarto, 'cozinha').map((c) => c.escolha.item.id)).toEqual(['prateleira']);
    await tirarDoLugar(repo, parede, 'cozinha');
    expect(colocadosNoQuarto(await repo.listRoomDecor(), 'cozinha')).toEqual([]);
    expect(colocadosNoQuarto(await repo.listRoomDecor())).toHaveLength(1);
  });

  test('pela loja de canto a compra fica guardada e não repete', async () => {
    const { repo, clock } = await comJoias(80);
    const pedido = { lugar: null, escolha: escolha('vaso') } as const;
    expect(await comprarOuColocar(repo, clock, pedido)).toBe(true);
    expect(await comprarOuColocar(repo, clock, pedido)).toBe(false);
    const [registro] = await repo.listRoomDecor();
    expect(registro).toMatchObject({ item: 'vaso', ...GUARDADO });
    expect(estadoDaCompra({ ...pedido, lugar: chao, quarto: [registro], saldo: 0 })).toMatchObject({ acao: 'colocar', bloqueado: false });
  });
});
