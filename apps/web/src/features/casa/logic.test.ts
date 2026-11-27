import { ROOM_DECOR, ROOM_GRID } from '@pulo/core/config/decisions';
import type { ComodoId } from '@pulo/core/domain/casa';
import { fixedClock } from '@pulo/core/domain/clock';
import { sp } from '@pulo/core/domain/test-utils';
import type { Habit, Repository, RoomDecor } from '@pulo/core/domain/types';

import { createMemoryRepository } from '@/data';

import { CORES, escolhaDoId, idDaCompra, precoDe, type Escolha } from './catalogo';
import { colocadosNoQuarto, comprarOuColocar, estadoDaCompra, tirarDoLugar } from './decoracao';
import { ajustarMinutos, joiasEstimadas, opcoesDeVinculo, preenchimento } from './logic';
import { GUARDADO, lugarDaPosicao, posicaoDoLugar } from './lugares';
import { MOVEIS } from './mobilia';

const MIN = 60_000;

/** A escolha de um registro, pelo id que a API vende. */
function escolha(id: string): Escolha {
  const encontrada = escolhaDoId(id);
  if (!encontrada) throw new Error(`sem item ${id}`);
  return encontrada;
}

const doQuarto = async (repo: Repository, comodo?: ComodoId) => [...colocadosNoQuarto(await repo.listRoomDecor(), comodo).values()].map(idDaCompra);

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
    for (const lugar of MOVEIS) expect(lugarDaPosicao(posicaoDoLugar(lugar))).toBe(lugar);
    expect(MOVEIS).toHaveLength(10);
    expect(MOVEIS.length).toBeLessThan(ROOM_GRID.columns * ROOM_GRID.rows);
    expect(lugarDaPosicao(GUARDADO)).toBeNull();
  });

  test('cada item de ROOM_DECOR tem um modelo, no lugar que o id diz', () => {
    const modelos = MOVEIS.flatMap((m) => m.modelos.map((modelo) => ({ lugar: m.id, id: modelo.id })));
    expect(modelos.map((m) => m.id).sort()).toEqual(Object.keys(ROOM_DECOR.itemCost).sort());
    for (const { lugar, id } of modelos) expect(id.startsWith(`${lugar}-`)).toBe(true);
    for (const lugar of MOVEIS) expect([2, 3]).toContain(lugar.modelos.length);
  });

  test('o id gravado é lugar-modelo, com a cor fora da natural, e o preço vem de ROOM_DECOR', () => {
    expect(idDaCompra(escolha('cama-estofada'))).toBe('cama-estofada');
    expect(idDaCompra(escolha('cama-estofada-rosa'))).toBe('cama-estofada-rosa');
    expect(precoDe(escolha('cama-estofada'))).toBe(60);
    expect(precoDe(escolha('cama-estofada-brilho'))).toBe(70);
  });

  test('todo modelo em toda cor volta do id gravado, e os ids antigos são ignorados', () => {
    for (const lugar of MOVEIS) {
      for (const modelo of lugar.modelos) {
        for (const cor of CORES) expect(escolhaDoId(idDaCompra({ lugar, modelo, cor }))).toEqual({ lugar, modelo, cor });
      }
    }
    for (const id of ['cama', 'cama-rosa', 'vaso', 'sofa-rosa', 'bau', 'cama-estofada-roxo']) expect(escolhaDoId(id)).toBeNull();
  });

  test('móvel fora do lugar dele ou antigo não aparece', () => {
    const registros: RoomDecor[] = [
      { item: 'assento-poltrona', cost: 60, createdAt: 1, ...posicaoDoLugar(escolha('quadro-paisagem').lugar) },
      { item: 'poltrona', cost: 60, createdAt: 1, ...posicaoDoLugar(escolha('assento-poltrona').lugar) },
    ];
    expect(colocadosNoQuarto(registros).size).toBe(0);
  });
});

describe('compra', () => {
  test('sem saldo o botão apaga e nada é gravado', async () => {
    const { repo, clock } = await comJoias(10);
    const pedido = { escolha: escolha('quadro-paisagem') };
    expect(estadoDaCompra({ ...pedido, quarto: [], saldo: 10 })).toMatchObject({ acao: 'comprar', bloqueado: true });
    expect(await comprarOuColocar(repo, clock, pedido)).toBe(false);
    expect(await repo.listRoomDecor()).toEqual([]);
  });

  test('um móvel por lugar: o antigo vai para o guardado e volta de graça', async () => {
    const { repo, clock } = await comJoias(80);
    const paisagem = { escolha: escolha('quadro-paisagem') };
    expect(await comprarOuColocar(repo, clock, paisagem)).toBe(true);
    expect(await comprarOuColocar(repo, clock, paisagem)).toBe(false);
    expect(await comprarOuColocar(repo, clock, { escolha: escolha('quadro-retrato') })).toBe(true);
    expect(await doQuarto(repo)).toEqual(['quadro-retrato']);
    const [primeiro] = await repo.listRoomDecor();
    expect(primeiro).toMatchObject({ item: 'quadro-paisagem', ...GUARDADO });

    expect(estadoDaCompra({ ...paisagem, quarto: await repo.listRoomDecor(), saldo: 0 })).toMatchObject({ acao: 'colocar', bloqueado: false });
    expect(await comprarOuColocar(repo, clock, paisagem)).toBe(true);
    expect(await doQuarto(repo)).toEqual(['quadro-paisagem']);
    expect((await repo.listRoomDecor()).map((d) => d.cost)).toEqual([30, 35]);

    await tirarDoLugar(repo, paisagem.escolha.lugar);
    expect(await doQuarto(repo)).toEqual([]);
    expect(await repo.listRoomDecor()).toHaveLength(2);
  });

  test('um item antigo na mesma casa da grade fica onde está', async () => {
    const { repo, clock } = await comJoias(80);
    const nova = escolha('quadro-paisagem');
    const antigo: RoomDecor = { item: 'quadro', cost: 30, createdAt: 1, ...posicaoDoLugar(nova.lugar) };
    await repo.saveRoomDecor(antigo);
    expect(await comprarOuColocar(repo, clock, { escolha: nova })).toBe(true);
    expect(await repo.listRoomDecor()).toContainEqual(antigo);
  });

  test('cada cômodo mostra e libera só a decoração dele', async () => {
    const { repo, clock } = await comJoias(80);
    const paisagem = escolha('quadro-paisagem');
    await comprarOuColocar(repo, clock, { escolha: paisagem });
    await comprarOuColocar(repo, clock, { escolha: escolha('quadro-retrato'), comodo: 'cozinha' });
    expect(await doQuarto(repo)).toEqual(['quadro-paisagem']);
    expect(await doQuarto(repo, 'cozinha')).toEqual(['quadro-retrato']);
    await tirarDoLugar(repo, paisagem.lugar, 'cozinha');
    expect(await doQuarto(repo, 'cozinha')).toEqual([]);
    expect(await doQuarto(repo)).toEqual(['quadro-paisagem']);
  });
});
