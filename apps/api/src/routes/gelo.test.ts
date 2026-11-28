import { HOUSE } from '@pulo/core/config/decisions';
import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { type TestUser, TEST_NOW, createHarness, queriesOf } from '../testing';

let database: TestDatabase;
let h: ReturnType<typeof createHarness>;

beforeAll(async () => {
  database = await createTestDatabase();
  h = createHarness(database);
});
afterAll(async () => {
  await database.close();
});

const RANGE = '?from=2026-11-01&to=2026-11-30';
const day = (key: string) => new Date(`${key}T00:00:00.000Z`);

/** Uma pessoa com hábito feito nos dias dados e o gelo resolvido até `resolvidoAte`. */
async function person(dates: string[], resolvidoAte?: string): Promise<TestUser> {
  const me = await h.newUser();
  const habitId = crypto.randomUUID();
  await database.db.habit.create({ data: { id: habitId, userId: me.id, title: 'Ler', weekdays: [0, 1, 2, 3, 4, 5, 6], state: 'ativo', createdAt: day('2026-01-01') } });
  await database.db.habitLog.createMany({ data: dates.map((date) => ({ userId: me.id, habitId, date: day(date), doneAt: new Date(TEST_NOW) })) });
  if (resolvidoAte !== undefined) {
    await database.db.mascotState.create({
      data: { userId: me.id, phase: 1, careDays: 0, updatedAt: new Date(TEST_NOW), geloResolvidoAte: day(resolvidoAte) },
    });
  }
  return me;
}

const rich = (me: TestUser, amount = 200) => database.db.joiaCredit.create({ data: { userId: me.id, amount } });
const json = async (response: Response | Promise<Response>) => (await response).json();

describe('/api/gelo', () => {
  it('exige sessão', async () => {
    expect((await h.app.request('/api/gelo')).status).toBe(401);
    expect((await h.app.request('/api/gelo', { method: 'POST' })).status).toBe(401);
    expect((await h.app.request('/api/gelo/visto', { method: 'PUT' })).status).toBe(401);
  });

  it('conta nova começa com o gelo de presente', async () => {
    const me = await h.newUser();
    expect(await json(me.call('GET', '/api/gelo'))).toEqual({ guardados: 1, max: 2, usados: [], recentes: [], compras: [] });
    expect((await json(me.call('GET', `/api/sync${RANGE}`))).descanso).toEqual({ restantesNaSemana: 2, maxPorSemana: 2 });
  });

  it('o sync depois de dois dias vazios protege o primeiro, avisa uma vez e a sequência quebra no segundo', async () => {
    const me = await person(['2026-11-15'], '2026-11-15');
    const body = await json(me.call('GET', `/api/sync${RANGE}`));
    expect(body.gelo).toEqual({ guardados: 0, max: 2, recentes: ['2026-11-16'] });
    expect(body.streak).toMatchObject({ atual: 0, recorde: 1 });
    expect(body.streak.semana).toContainEqual({ date: '2026-11-16', estado: 'gelo' });
    // De novo não gasta nada.
    expect((await json(me.call('GET', `/api/sync${RANGE}`))).gelo).toEqual(body.gelo);

    expect(await json(me.call('PUT', '/api/gelo/visto'))).toEqual({ vistos: 1 });
    expect((await json(me.call('GET', `/api/sync${RANGE}`))).gelo.recentes).toEqual([]);
    expect((await json(me.call('GET', '/api/gelo'))).usados).toEqual(['2026-11-16']);
  });

  it('um dia vazio protegido mantém a chama, e a próxima escrita dá a conquista', async () => {
    const me = await person(['2026-11-16'], '2026-11-16');
    expect((await json(me.call('GET', '/api/streak'))).streak).toMatchObject({ atual: 1 });
    const habit = await database.db.habit.findFirstOrThrow({ where: { userId: me.id } });
    const log = { habitId: habit.id, date: '2026-11-18', doneAt: TEST_NOW };
    const saved = await json(me.call('PUT', `/api/habit-logs/${habit.id}/2026-11-18`, log));
    expect(saved.newAchievements).toEqual([expect.objectContaining({ id: 'gelo-na-hora', nome: 'Gelo na hora certa' })]);
  });

  it('quem nunca teve o gelo acertado não gasta por dias antigos', async () => {
    const me = await person(['2026-11-15']);
    expect((await json(me.call('GET', `/api/sync${RANGE}`))).gelo).toEqual({ guardados: 1, max: 2, recentes: [] });
    const row = await database.db.mascotState.findUniqueOrThrow({ where: { userId: me.id } });
    expect(row.geloResolvidoAte).toEqual(day('2026-11-17'));
  });

  it('compra com joias, gasta o preço e recusa no máximo', async () => {
    const me = await h.newUser();
    await rich(me);
    const bought = await json(me.call('POST', '/api/gelo'));
    expect(bought).toMatchObject({ guardados: 2, compras: [{ item: 'gelo-1', cost: 50, createdAt: TEST_NOW }] });
    const again = await me.call('POST', '/api/gelo');
    expect(again.status).toBe(409);
    expect((await again.json()).error).toBe('gelo_no_maximo');
    // O gasto aparece no saldo da casa: 200 - 50 = 150; depois da varanda (120) sobram 30, menos que a cerca.
    const buy = (item: string, cost: number) => me.call('PUT', `/api/house/${item}`, { item, cost, createdAt: TEST_NOW });
    expect((await buy('varanda', HOUSE.partCost.varanda)).status).toBe(200);
    expect((await json(buy('cerca', HOUSE.partCost.cerca))).error).toBe('joias_insuficientes');
    expect((await json(me.call('GET', `/api/sync${RANGE}`))).gelosComprados).toHaveLength(1);
  });

  it('sem joias: devolve o erro e não gasta nada', async () => {
    const me = await h.newUser();
    await rich(me, 49);
    const res = await me.call('POST', '/api/gelo');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'joias_insuficientes', message: 'Falta 1 joia.' });
    expect(await database.db.islandPurchase.count({ where: { userId: me.id } })).toBe(0);
  });

  it('comprar não salva um dia que já terminou', async () => {
    const me = await person(['2026-11-15'], '2026-11-15');
    await rich(me);
    expect(await json(me.call('POST', '/api/gelo'))).toMatchObject({ guardados: 1, usados: ['2026-11-16'] });
  });

  it('apagar um hábito não faz os dias já cumpridos gastarem gelo', async () => {
    const me = await person(['2026-11-16', '2026-11-17'], '2026-11-15');
    const habit = await database.db.habit.findFirstOrThrow({ where: { userId: me.id } });
    await me.call('DELETE', `/api/habits/${habit.id}`);
    expect((await json(me.call('GET', '/api/gelo'))).usados).toEqual([]);
  });

  it('isolamento: o gelo de uma pessoa não aparece nem é marcado pela outra', async () => {
    const a = await person(['2026-11-16'], '2026-11-16');
    const b = await h.newUser();
    await a.call('GET', '/api/gelo');
    expect((await json(b.call('GET', '/api/gelo'))).usados).toEqual([]);
    expect(await json(b.call('PUT', '/api/gelo/visto'))).toEqual({ vistos: 0 });
    expect((await json(a.call('GET', '/api/gelo'))).recentes).toEqual(['2026-11-17']);
  });

  it('queries: número fixo com 1 e com 50 registros', async () => {
    const small = await person(['2026-11-17'], '2026-11-17');
    const big = await person(Array.from({ length: 28 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`), '2026-11-17');
    await database.db.freezeUse.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({ userId: big.id, date: new Date(Date.UTC(2025, 0, 1 + i)) })),
    });
    const both = async (method: 'GET' | 'PUT', path: string) => {
      const count = await queriesOf(database, small, method, path);
      expect(await queriesOf(database, big, method, path)).toBe(count);
      return count;
    };
    // 2 de sessão + 6 do acerto + 2 da resposta.
    expect(await both('GET', '/api/gelo')).toBe(10);
    expect(await both('PUT', '/api/gelo/visto')).toBe(3);
    await both('GET', '/api/profile/metrics');
  });
});
