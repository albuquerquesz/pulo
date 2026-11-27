import { HOUSE, ROOM_DECOR, ROOM_GRID } from '../config/decisions';
import { createMemoryRepository } from '../data/memory-repository';
import {
  COMODOS,
  DECORACOES,
  PARTES,
  casaCompleta,
  comprarDecoracao,
  comprarParte,
  estadoDaCasa,
  moverDecoracao,
  precoDaDecoracao,
  podeComprar,
  progressoPorCamada,
  textoDoRequisito,
  verCasa,
} from './casa';
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
  it('começa só com o quarto, 1 de 24, vazio, e a próxima é a mais barata liberada', () => {
    const casa = estadoDaCasa(nada, [], []);
    expect([casa.construidas, casa.total, casa.completa]).toEqual([1, 24, false]);
    expect(casa.comodos).toEqual(['quarto']);
    expect(casa.proxima).toEqual({ id: 'caixa-correio', nome: 'Caixa de correio', custo: 30, faltam: 30, horasDeFoco: 3 });
    expect(casa.decoracoes.every((d) => d.posicao === null)).toBe(true);
  });

  it('compra fora de qualquer ordem e recusa saldo negativo, repetida e inexistente', async () => {
    const repo = createMemoryRepository({ habitLogs: habitos(HOUSE.partCost.varanda) });
    expect(await comprarParte(repo, clock, 'cozinha')).toMatchObject({ ok: false, error: { code: 'joias_insuficientes', message: 'Faltam 80 joias.' } });
    expect(await comprarParte(repo, clock, 'varanda')).toMatchObject({ ok: true, value: { saldo: 0, construidas: 2 } });
    expect(await comprarParte(repo, clock, 'varanda')).toMatchObject({ ok: false, error: { code: 'ja_comprado' } });
    expect(await comprarParte(repo, clock, 'quarto')).toMatchObject({ ok: false, error: { code: 'ja_comprado' } });
    expect(await comprarParte(repo, clock, 'praia')).toMatchObject({ ok: false, error: { code: 'item_inexistente' } });
    expect(await repo.listHousePurchases()).toEqual([{ item: 'varanda', cost: 120, createdAt: 5 }]);
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

  it('todo item se vende em toda cor, com o acréscimo da cor', async () => {
    expect(precoDaDecoracao('relogio')).toBe(ROOM_DECOR.itemCost.relogio);
    expect(precoDaDecoracao('relogio-brilho')).toBe(ROOM_DECOR.itemCost.relogio + ROOM_DECOR.colorCost.brilho);
    for (const id of ['relogio-roxo', 'praia-rosa', 'relogio-rosa-verde', '-rosa']) expect(precoDaDecoracao(id)).toBeNull();
    const repo = createMemoryRepository({ habitLogs: habitos(60) });
    expect(await comprarDecoracao(repo, clock, 'relogio-rosa', canto)).toMatchObject({ ok: true });
    expect(await comprarDecoracao(repo, clock, 'relogio-rosa', canto)).toMatchObject({ ok: false, error: { code: 'ja_comprado' } });
    const casa = await verCasa(repo);
    expect(casa.decoracoes.find((d) => d.id === 'relogio-rosa')).toMatchObject({ nome: 'Relógio rosa', custo: 20, posicao: canto });
    expect(casa.decoracoes.find((d) => d.id === 'relogio')?.posicao).toBeNull();
  });

  it('decorar um cômodo pede que ele esteja construído, e mover leva o item de um para outro', async () => {
    const repo = createMemoryRepository({ habitLogs: habitos(220) });
    const naCozinha = { ...canto, comodo: 'cozinha' } as const;
    expect(await comprarDecoracao(repo, clock, 'tapete', naCozinha)).toMatchObject({ ok: false, error: { code: 'comodo_nao_comprado' } });
    await comprarDecoracao(repo, clock, 'tapete', canto);
    expect(await moverDecoracao(repo, 'tapete', naCozinha)).toMatchObject({ ok: false, error: { code: 'comodo_nao_comprado' } });
    await comprarParte(repo, clock, 'cozinha');
    expect(await moverDecoracao(repo, 'tapete', naCozinha)).toMatchObject({ ok: true, value: { comodos: ['quarto', 'cozinha'] } });
    // Mover sem dizer o cômodo mantém o atual.
    await moverDecoracao(repo, 'tapete', { x: 1, y: 1, rotation: 0 });
    expect((await repo.listRoomDecor())[0]).toMatchObject({ x: 1, comodo: 'cozinha' });
  });

  it('o catálogo tem nome e preço para tudo', () => {
    expect(PARTES.map((p) => p.id)).toEqual(Object.keys(HOUSE.partCost));
    expect(DECORACOES.map((d) => d.id)).toEqual(Object.keys(ROOM_DECOR.itemCost));
  });
});

describe('acesso à próxima ilha', () => {
  it('só abre com todas as partes prontas', () => {
    const todas = PARTES.map((p) => p.id);
    expect(casaCompleta(todas)).toBe(true);
    expect(casaCompleta(todas.filter((id) => id !== 'piscina'))).toBe(false);
    // O quarto vem de graça e conta mesmo sem compra.
    expect(casaCompleta(todas.filter((id) => id !== 'quarto'))).toBe(true);
  });
});

describe('catálogo da mansão', () => {
  const idsDe = (camada: string) => PARTES.filter((p) => p.camada === camada).length;

  it('bate com a tabela da spec: partes por camada e total em joias', () => {
    expect([idsDe('comodo'), idsDe('estrutura'), idsDe('exterior')]).toEqual([8, 4, 12]);
    expect(PARTES.reduce((total, p) => total + p.custo, 0)).toBe(9855);
    expect(HOUSE.partCost).toMatchObject({ quarto: 0, cozinha: 200, varanda: 120, jardim: 80, arvore: 120, cerca: 50 });
    expect(COMODOS).toHaveLength(8);
  });

  it('todo requisito existe e não há ciclo', () => {
    for (const parte of PARTES) {
      const visitadas = new Set<string>();
      let atual: string | undefined = parte.id;
      while (atual) {
        expect(visitadas.has(atual)).toBe(false);
        visitadas.add(atual);
        const achada = PARTES.find((p) => p.id === atual);
        expect(achada).toBeDefined();
        atual = achada?.requer;
      }
    }
  });

  it('podeComprar dá cada resultado', () => {
    expect(podeComprar('quarto', [], 0)).toEqual({ situacao: 'ja_tem' });
    expect(podeComprar('cerca', ['cerca'], 100)).toEqual({ situacao: 'ja_tem' });
    expect(podeComprar('cerca', [], 50)).toEqual({ situacao: 'ok' });
    expect(podeComprar('cerca', [], 49)).toEqual({ situacao: 'joias_insuficientes', faltam: 1 });
    expect(podeComprar('torre', [], 9999)).toEqual({ situacao: 'falta_requisito', requer: 'segundo-andar' });
  });

  it('a cadeia de requisitos libera um passo de cada vez', () => {
    expect(podeComprar('observatorio', [], 9999)).toEqual({ situacao: 'falta_requisito', requer: 'torre' });
    expect(podeComprar('segundo-andar', [], 9999)).toEqual({ situacao: 'falta_requisito', requer: 'sala' });
    expect(podeComprar('segundo-andar', ['sala'], 9999)).toEqual({ situacao: 'ok' });
    expect(podeComprar('torre', ['sala', 'segundo-andar'], 9999)).toEqual({ situacao: 'ok' });
    expect(textoDoRequisito('segundo-andar')).toBe('Precisa do Segundo andar');
    expect(textoDoRequisito('sala')).toBe('Precisa da Sala de estar');
  });

  it('conta o progresso por camada', () => {
    expect(progressoPorCamada(['sala', 'segundo-andar', 'cerca'])).toEqual({
      comodo: { feitas: 2, total: 8 },
      estrutura: { feitas: 1, total: 4 },
      exterior: { feitas: 1, total: 12 },
    });
  });
});
