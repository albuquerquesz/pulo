import { HOUSE, ROOM_DECOR, ROOM_GRID } from '../config/decisions';
import { createMemoryRepository } from '../data/memory-repository';
import { DECORACOES, PARTES, comprarDecoracao, comprarParte, estadoDaCasa, moverDecoracao, verCasa } from './casa';
import { joiasDoFoco, type FontesDeJoias } from './joias';
import { endedSession, sp } from './test-utils';

const clock = { now: () => 5 };
const nada: FontesDeJoias = { habitLogs: [], sessions: [], restDays: [], goals: [], baus: [], credito: 0 };
const habitos = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ habitId: 'h', date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), doneAt: i }));
const canto = { x: 0, y: 0, rotation: 0 } as const;

describe('joias do foco', () => {
  const foco = (minutos: number, planejado = 50) => endedSession(sp(2026, 11, 2), planejado, 'interrompida', minutos);

  it.each([
    [4, 0],
    [5, 1],
    [49, 9],
  ])('%i minutos rendem %i joias', (minutos, joias) => {
    expect(joiasDoFoco(foco(minutos))).toBe(joias);
  });

  it('não passa do planejado, ignora pausas e sessão em andamento', () => {
    expect(joiasDoFoco(foco(120, 25))).toBe(5);
    expect(joiasDoFoco({ ...foco(20), pausedMs: 11 * 60_000 })).toBe(1);
    expect(joiasDoFoco({ id: 's', startedAt: 0, plannedMinutes: 25, state: 'em_andamento', pausedMs: 0 })).toBe(0);
  });
});

describe('casa', () => {
  it('começa só com o quarto, 1 de 6, quarto vazio e a próxima é a mais barata', () => {
    const casa = estadoDaCasa(nada, [], []);
    expect([casa.construidas, casa.total, casa.completa]).toEqual([1, 6, false]);
    expect(casa.proxima).toEqual({ id: 'cerca', nome: 'Cerca', custo: HOUSE.partCost.cerca, faltam: 40, horasDeFoco: 4 });
    expect(casa.decoracoes.every((d) => d.posicao === null)).toBe(true);
  });

  it('compra fora de qualquer ordem e recusa saldo negativo, repetida e inexistente', async () => {
    const repo = createMemoryRepository({ habitLogs: habitos(HOUSE.partCost.varanda) });
    expect(await comprarParte(repo, clock, 'cozinha')).toMatchObject({ ok: false, error: { code: 'joias_insuficientes', message: 'Faltam 40 joias.' } });
    expect(await comprarParte(repo, clock, 'varanda')).toMatchObject({ ok: true, value: { saldo: 0, construidas: 2 } });
    expect(await comprarParte(repo, clock, 'varanda')).toMatchObject({ ok: false, error: { code: 'ja_comprado' } });
    expect(await comprarParte(repo, clock, 'quarto')).toMatchObject({ ok: false, error: { code: 'ja_comprado' } });
    expect(await comprarParte(repo, clock, 'praia')).toMatchObject({ ok: false, error: { code: 'item_inexistente' } });
    expect(await repo.listHousePurchases()).toEqual([{ item: 'varanda', cost: 80, createdAt: 5 }]);
  });

  it('desfazer hábito depois da compra deixa o saldo em zero e não tira a compra', async () => {
    const repo = createMemoryRepository({ habitLogs: habitos(HOUSE.partCost.cerca) });
    await comprarParte(repo, clock, 'cerca');
    await repo.deleteHabitLog('h', '2026-01-01');
    const casa = await verCasa(repo);
    expect([casa.saldo, casa.construidas]).toEqual([0, 2]);
  });

  it('compra decoração com posição e mover é grátis', async () => {
    const repo = createMemoryRepository({ habitLogs: habitos(20), joiaCredit: 5 });
    expect(await moverDecoracao(repo, 'tapete', canto)).toMatchObject({ ok: false, error: { code: 'nao_encontrado' } });
    expect(await comprarDecoracao(repo, clock, 'tapete', { ...canto, x: ROOM_GRID.columns })).toMatchObject({ ok: false, error: { code: 'corpo_invalido' } });
    expect(await comprarDecoracao(repo, clock, 'tapete', canto)).toMatchObject({ ok: true, value: { saldo: 25 - ROOM_DECOR.itemCost.tapete } });
    const movido = await moverDecoracao(repo, 'tapete', { x: 2, y: 3, rotation: 90 });
    expect(movido).toMatchObject({ ok: true, value: { saldo: 15 } });
    expect(await repo.listRoomDecor()).toEqual([{ item: 'tapete', cost: 10, createdAt: 5, x: 2, y: 3, rotation: 90 }]);
  });

  it('o catálogo tem nome e preço para tudo', () => {
    expect(PARTES.map((p) => p.id)).toEqual(Object.keys(HOUSE.partCost));
    expect(DECORACOES.map((d) => d.id)).toEqual(Object.keys(ROOM_DECOR.itemCost));
  });
});
