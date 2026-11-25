import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { TEST_NOW, createHarness, queriesOf } from '../testing';

/** Quarta, o hoje do relógio dos testes. */
const HOJE = '2026-11-18';

let database: TestDatabase;
let h: ReturnType<typeof createHarness>;

beforeAll(async () => {
  database = await createTestDatabase();
  h = createHarness(database);
});
afterAll(async () => {
  await database.close();
});

describe('/api/rest-days', () => {
  it('exige sessão', async () => {
    expect((await h.app.request('/api/rest-days')).status).toBe(401);
    expect((await h.app.request('/api/rest-days/2026-11-16', { method: 'PUT' })).status).toBe(401);
    expect((await h.app.request('/api/rest-days/2026-11-16', { method: 'DELETE' })).status).toBe(401);
  });

  it('cria (idempotente), lista e apaga o de hoje, devolvendo o sapo atualizado', async () => {
    const me = await h.newUser();
    await database.db.restDay.create({ data: { userId: me.id, date: new Date('2026-11-16') } });
    const first = await (await me.call('PUT', `/api/rest-days/${HOJE}`)).json();
    expect(first.restDay).toEqual({ date: HOJE });
    expect(first.mascot).toEqual({ phase: 1, careDays: 2, updatedAt: h.now() });
    const again = await (await me.call('PUT', `/api/rest-days/${HOJE}`)).json();
    expect(again.mascot.careDays).toBe(2);

    expect((await (await me.call('GET', '/api/rest-days')).json()).restDays).toEqual([{ date: '2026-11-16' }, { date: HOJE }]);
    expect((await (await me.call('GET', '/api/rest-days?from=2026-11-17&to=2026-11-30')).json()).restDays).toEqual([{ date: HOJE }]);

    const removed = await (await me.call('DELETE', `/api/rest-days/${HOJE}`)).json();
    expect(removed.deleted).toBe(1);
    // O sapo nunca regride: os dias de cuidado guardados não diminuem.
    expect(removed.mascot.careDays).toBe(2);
    expect((await (await me.call('GET', '/api/mascot')).json()).mascot).toEqual(removed.mascot);
  });

  it('recusa ontem e amanhã com descanso_so_hoje, ao marcar e ao desmarcar, sem gravar nada', async () => {
    const me = await h.newUser();
    await database.db.restDay.create({ data: { userId: me.id, date: new Date('2026-11-17') } });
    for (const method of ['PUT', 'DELETE'] as const) {
      for (const date of ['2026-11-17', '2026-11-19']) {
        const res = await me.call(method, `/api/rest-days/${date}`);
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe('descanso_so_hoje');
      }
    }
    expect((await (await me.call('GET', '/api/rest-days')).json()).restDays).toEqual([{ date: '2026-11-17' }]);
  });

  it('perto da virada, o hoje é o do fuso e do começo do dia da pessoa', async () => {
    const me = await h.newUser({ timezone: 'Asia/Tokyo' });
    // 00h30 do dia 19 em Tóquio: o dia lógico ainda é 18.
    h.setNow(Date.UTC(2026, 10, 18, 15, 30));
    try {
      expect((await me.call('PUT', '/api/rest-days/2026-11-19')).status).toBe(400);
      expect((await me.call('PUT', `/api/rest-days/${HOJE}`)).status).toBe(200);
    } finally {
      h.setNow(TEST_NOW);
    }
  });

  it('limite por semana do app (de domingo a sábado)', async () => {
    const me = await h.newUser();
    // Sábado 14 é da semana anterior; domingo 15 e segunda 16 são desta.
    await database.db.restDay.createMany({
      data: ['2026-11-14', '2026-11-15'].map((date) => ({ userId: me.id, date: new Date(date) })),
    });
    expect((await me.call('PUT', `/api/rest-days/${HOJE}`)).status).toBe(200);
    await me.call('DELETE', `/api/rest-days/${HOJE}`);
    await database.db.restDay.create({ data: { userId: me.id, date: new Date('2026-11-16') } });
    const res = await me.call('PUT', `/api/rest-days/${HOJE}`);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('limite_de_descanso');
  });

  it('a fase sobe com os dias de descanso e nunca regride', async () => {
    const me = await h.newUser();
    await database.db.restDay.createMany({
      data: ['2026-10-02', '2026-10-03'].map((date) => ({ userId: me.id, date: new Date(date) })),
    });
    await me.call('PUT', `/api/rest-days/${HOJE}`);
    expect((await (await me.call('GET', '/api/mascot')).json()).mascot).toMatchObject({ phase: 2, careDays: 3 });
    await me.call('DELETE', `/api/rest-days/${HOJE}`);
    expect((await (await me.call('GET', '/api/mascot')).json()).mascot).toMatchObject({ phase: 2, careDays: 3 });
  });

  it('valida a data do caminho', async () => {
    const me = await h.newUser();
    for (const bad of ['2026-02-31', 'hoje', '2026-1-1']) {
      const res = await me.call('PUT', `/api/rest-days/${bad}`);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('parametro_invalido');
    }
  });

  it('isolamento: o descanso de uma pessoa não aparece nem é apagado pela outra', async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    await a.call('PUT', `/api/rest-days/${HOJE}`);
    expect((await (await b.call('GET', '/api/rest-days')).json()).restDays).toEqual([]);
    expect((await (await b.call('DELETE', `/api/rest-days/${HOJE}`)).json()).deleted).toBe(0);
    expect((await (await b.call('GET', '/api/mascot')).json()).mascot).toMatchObject({ careDays: 0 });
    expect((await (await a.call('GET', '/api/rest-days')).json()).restDays).toEqual([{ date: HOJE }]);
    // A mesma data nas duas contas é independente.
    await b.call('PUT', `/api/rest-days/${HOJE}`);
    expect((await (await a.call('GET', '/api/rest-days')).json()).restDays).toHaveLength(1);
  });

  it('queries: número fixo com 1 e com 50 dias', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    await database.db.restDay.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({ userId: big.id, date: new Date(Date.UTC(2026, 0, 1 + i)) })),
    });
    const get = await queriesOf(database, small, 'GET', '/api/rest-days?from=2026-01-01&to=2026-12-31');
    expect(await queriesOf(database, big, 'GET', '/api/rest-days?from=2026-01-01&to=2026-12-31')).toBe(get);
    expect(get).toBe(3);
    // Grava o que o histórico já destrava e acerta o gelo do dia, para a contagem abaixo não incluir esses INSERTs.
    for (const user of [small, big]) await user.call('PUT', `/api/rest-days/${HOJE}`);
    const put = await queriesOf(database, small, 'PUT', `/api/rest-days/${HOJE}`);
    expect(await queriesOf(database, big, 'PUT', `/api/rest-days/${HOJE}`)).toBe(put);
    const del = await queriesOf(database, small, 'DELETE', `/api/rest-days/${HOJE}`);
    expect(await queriesOf(database, big, 'DELETE', `/api/rest-days/${HOJE}`)).toBe(del);
    // 2 de sessão + o acerto do gelo (6) + 2 leituras do dia + o delete + o sapo (4).
    expect(del).toBe(15);
    // 2 de sessão + 2 leituras do dia + o insert + o sapo (4) + 8 leituras das conquistas.
    expect(put).toBe(17);

    const mascot = await queriesOf(database, big, 'GET', '/api/mascot');
    expect(mascot).toBe(3);
  });
});
