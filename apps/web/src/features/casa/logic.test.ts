import { ROOM_GRID } from '@pulo/core/config/decisions';
import { fixedClock } from '@pulo/core/domain/clock';
import { sp } from '@pulo/core/domain/test-utils';
import type { Habit, RoomDecor } from '@pulo/core/domain/types';

import { createMemoryRepository } from '@/data';

import { CORES, escolhaDoId, idDaCompra, ITENS, precoDe, type Escolha } from './catalogo';
import { colocadosNoQuarto, comprarOuColocar, estadoDaCompra, tirarDoLugar } from './decoracao';
import { ajustarMinutos, joiasEstimadas, opcoesDeVinculo, preenchimento } from './logic';
import { GUARDADO, lugarDaPosicao, LUGARES, posicaoDoLugar } from './lugares';

const MIN = 60_000;

function escolha(item: string, cor = 'natural'): Escolha {
  const encontrada = escolhaDoId(cor === 'natural' ? item : `${item}:${cor}`);
  if (!encontrada) throw new Error(`sem item ${item}`);
  return encontrada;
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

  test('preço do item mais a cor', () => {
    expect(precoDe(escolha('cama'), 'completa')).toBe(60);
    expect(precoDe(escolha('cama', 'brilho'), 'completa')).toBe(70);
  });

  test('a conta só compra o que a API vende, com o preço dela', () => {
    expect(idDaCompra(escolha('quadro'), 'servidor')).toBe('quadro');
    expect(precoDe(escolha('quadro'), 'servidor')).toBe(30);
    expect(idDaCompra(escolha('quadro', 'rosa'), 'servidor')).toBeNull();
    expect(idDaCompra(escolha('cama'), 'servidor')).toBeNull();
    expect(idDaCompra(escolha('planta'), 'completa')).toBe('vaso');
  });

  test('todo par de item e cor volta do id gravado', () => {
    for (const item of ITENS) {
      for (const cor of CORES) {
        const id = idDaCompra({ item, cor }, 'completa');
        expect(id && escolhaDoId(id)).toEqual({ item, cor });
      }
    }
  });

  test('item em lugar de outro tipo não aparece', () => {
    const registro: RoomDecor = { item: 'cama', cost: 60, createdAt: 1, ...posicaoDoLugar(parede) };
    expect(colocadosNoQuarto([registro])).toEqual([]);
  });
});

describe('compra', () => {
  test('sem saldo o botão apaga e nada é gravado', async () => {
    const { repo, clock } = await comJoias(10);
    const pedido = { loja: 'completa', lugar: parede, escolha: escolha('quadro') } as const;
    expect(estadoDaCompra({ ...pedido, quarto: [], saldo: 10 })).toMatchObject({ acao: 'comprar', bloqueado: true });
    expect(await comprarOuColocar(repo, clock, pedido)).toBe(false);
    expect(await repo.listRoomDecor()).toEqual([]);
  });

  test('comprar grava, mover é de graça e o antigo do lugar vai para o guardado', async () => {
    const { repo, clock } = await comJoias(40);
    const quadro = { loja: 'completa', escolha: escolha('quadro') } as const;
    expect(await comprarOuColocar(repo, clock, { ...quadro, lugar: parede })).toBe(true);
    expect(await comprarOuColocar(repo, clock, { ...quadro, lugar: outraParede })).toBe(true);
    expect(await repo.listRoomDecor()).toHaveLength(1);
    expect(colocadosNoQuarto(await repo.listRoomDecor()).map((c) => c.lugar.id)).toEqual([outraParede.id]);

    await comprarOuColocar(repo, clock, { loja: 'completa', escolha: escolha('relogio'), lugar: outraParede });
    const quarto = await repo.listRoomDecor();
    expect(quarto.map((d) => d.cost)).toEqual([15, 20]);
    expect(colocadosNoQuarto(quarto).map((c) => c.escolha.item.id)).toEqual(['relogio']);

    await tirarDoLugar(repo, outraParede);
    expect(colocadosNoQuarto(await repo.listRoomDecor())).toEqual([]);
    expect(await repo.listRoomDecor()).toHaveLength(2);
  });

  test('cada cômodo mostra e libera só a decoração dele', async () => {
    const { repo, clock } = await comJoias(60);
    const quadro = { loja: 'completa', escolha: escolha('quadro'), lugar: parede } as const;
    const relogio = { loja: 'completa', escolha: escolha('relogio'), lugar: parede, comodo: 'cozinha' } as const;
    await comprarOuColocar(repo, clock, quadro);
    await comprarOuColocar(repo, clock, relogio);
    const quarto = await repo.listRoomDecor();
    expect(colocadosNoQuarto(quarto).map((c) => c.escolha.item.id)).toEqual(['quadro']);
    expect(colocadosNoQuarto(quarto, 'cozinha').map((c) => c.escolha.item.id)).toEqual(['relogio']);
    await tirarDoLugar(repo, parede, 'cozinha');
    expect(colocadosNoQuarto(await repo.listRoomDecor(), 'cozinha')).toEqual([]);
    expect(colocadosNoQuarto(await repo.listRoomDecor())).toHaveLength(1);
  });

  test('pela loja de canto a compra fica guardada e não repete', async () => {
    const { repo, clock } = await comJoias(40);
    const pedido = { loja: 'completa', lugar: null, escolha: escolha('planta') } as const;
    expect(await comprarOuColocar(repo, clock, pedido)).toBe(true);
    expect(await comprarOuColocar(repo, clock, pedido)).toBe(false);
    const [registro] = await repo.listRoomDecor();
    expect(registro).toMatchObject({ item: 'vaso', ...GUARDADO });
    expect(estadoDaCompra({ ...pedido, lugar: chao, quarto: [registro], saldo: 0 })).toMatchObject({ acao: 'colocar', bloqueado: false });
  });
});
