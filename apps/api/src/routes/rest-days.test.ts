import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { createHarness, queriesOf } from '../testing';

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

  it('cria (idempotente), lista e apaga, devolvendo o sapo atualizado', async () => {
    const me = await h.newUser();
    const first = await (await me.call('PUT', '/api/rest-days/2026-11-16')).json();
    expect(first.restDay).toEqual({ date: '2026-11-16' });
    expect(first.mascot).toEqual({ phase: 1, careDays: 1, updatedAt: h.now() });
    const again = await (await me.call('PUT', '/api/rest-days/2026-11-16')).json();
    expect(again.mascot.careDays).toBe(1);

    await me.call('PUT', '/api/rest-days/2026-11-20');
    expect((await (await me.call('GET', '/api/rest-days')).json()).restDays).toEqual([{ date: '2026-11-16' }, { date: '2026-11-20' }]);
    expect((await (await me.call('GET', '/api/rest-days?from=2026-11-17&to=2026-11-30')).json()).restDays).toEqual([{ date: '2026-11-20' }]);

    const removed = await (await me.call('DELETE', '/api/rest-days/2026-11-16')).json();
    expect(removed.deleted).toBe(1);
    // O sapo nunca regride: os dias de cuidado guardados não diminuem.
    expect(removed.mascot.careDays).toBe(2);
    expect((await (await me.call('GET', '/api/mascot')).json()).mascot).toEqual(removed.mascot);
  });

  it('a fase sobe com os dias de descanso e nunca regride', async () => {
    const me = await h.newUser();
    for (const day of ['02', '03', '04']) await me.call('PUT', `/api/rest-days/2026-10-${day}`);
    const up = await (await me.call('GET', '/api/mascot')).json();
    expect(up.mascot).toMatchObject({ phase: 2, careDays: 3 });
    for (const day of ['02', '03', '04']) await me.call('DELETE', `/api/rest-days/2026-10-${day}`);
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
    await a.call('PUT', '/api/rest-days/2026-11-16');
    expect((await (await b.call('GET', '/api/rest-days')).json()).restDays).toEqual([]);
    expect((await (await b.call('DELETE', '/api/rest-days/2026-11-16')).json()).deleted).toBe(0);
    expect((await (await b.call('GET', '/api/mascot')).json()).mascot).toMatchObject({ careDays: 0 });
    expect((await (await a.call('GET', '/api/rest-days')).json()).restDays).toEqual([{ date: '2026-11-16' }]);
    // A mesma data nas duas contas é independente.
    await b.call('PUT', '/api/rest-days/2026-11-16');
    expect((await (await a.call('GET', '/api/rest-days')).json()).restDays).toHaveLength(1);
  });

  it('queries: número fixo com 1 e com 50 dias', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    await database.db.restDay.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({ userId: big.id, date: new Date(Date.UTC(2026, 0, 1 + i)) })),
    });
    await small.call('PUT', '/api/rest-days/2026-11-16');

    const get = await queriesOf(database, small, 'GET', '/api/rest-days?from=2026-01-01&to=2026-12-31');
    expect(await queriesOf(database, big, 'GET', '/api/rest-days?from=2026-01-01&to=2026-12-31')).toBe(get);
    expect(get).toBe(3);
    const put = await queriesOf(database, small, 'PUT', '/api/rest-days/2026-11-17');
    expect(await queriesOf(database, big, 'PUT', '/api/rest-days/2026-11-17')).toBe(put);
    const del = await queriesOf(database, small, 'DELETE', '/api/rest-days/2026-11-17');
    expect(await queriesOf(database, big, 'DELETE', '/api/rest-days/2026-11-17')).toBe(del);
    expect(put).toBe(del);
    expect(put).toBe(7);

    const mascot = await queriesOf(database, big, 'GET', '/api/mascot');
    expect(mascot).toBe(3);
  });
});
