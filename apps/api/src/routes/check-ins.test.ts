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

const uuid = () => crypto.randomUUID();
const CREATED = 1_794_990_000_000;
const checkIn = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  date: '2026-11-17',
  period: 'manha',
  energy: 3,
  createdAt: CREATED,
  ...extra,
});

describe('/api/check-ins', () => {
  it('exige sessão', async () => {
    expect((await h.app.request('/api/check-ins')).status).toBe(401);
    expect((await h.app.request(`/api/check-ins/${uuid()}`, { method: 'PUT' })).status).toBe(401);
  });

  it('salva (idempotente), troca o valor e filtra por intervalo', async () => {
    const me = await h.newUser();
    const id = uuid();
    const res = await me.call('PUT', `/api/check-ins/${id}`, checkIn(id));
    expect(await res.json()).toEqual({ checkIn: checkIn(id) });
    await me.call('PUT', `/api/check-ins/${id}`, checkIn(id, { energy: 5 }));
    const other = uuid();
    await me.call('PUT', `/api/check-ins/${other}`, checkIn(other, { date: '2026-11-30', period: 'noite' }));

    const all = (await (await me.call('GET', '/api/check-ins')).json()).checkIns;
    expect(all).toEqual([checkIn(id, { energy: 5 }), checkIn(other, { date: '2026-11-30', period: 'noite' })]);
    const week = (await (await me.call('GET', '/api/check-ins?from=2026-11-16&to=2026-11-22')).json()).checkIns;
    expect(week).toEqual([checkIn(id, { energy: 5 })]);
    const onlyTo = (await (await me.call('GET', '/api/check-ins?to=2026-11-20')).json()).checkIns;
    expect(onlyTo).toHaveLength(1);
  });

  it('valida energia de 1 a 5, período, data e futuro', async () => {
    const me = await h.newUser();
    const id = uuid();
    for (const bad of [
      checkIn(id, { energy: 0 }),
      checkIn(id, { energy: 6 }),
      checkIn(id, { energy: 2.5 }),
      checkIn(id, { period: 'madrugada' }),
      checkIn(id, { date: '17/11/2026' }),
    ]) {
      const res = await me.call('PUT', `/api/check-ins/${id}`, bad);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('corpo_invalido');
    }
    for (const energy of [1, 5]) expect((await me.call('PUT', `/api/check-ins/${id}`, checkIn(id, { energy }))).status).toBe(200);
    const future = await me.call('PUT', `/api/check-ins/${id}`, checkIn(id, { createdAt: h.now() + 3_600_000 }));
    expect((await future.json()).error).toBe('horario_no_futuro');
  });

  it('isolamento: outra pessoa não lê nem sobrescreve', async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    const id = uuid();
    await a.call('PUT', `/api/check-ins/${id}`, checkIn(id));
    expect((await (await b.call('GET', '/api/check-ins')).json()).checkIns).toEqual([]);
    expect((await b.call('PUT', `/api/check-ins/${id}`, checkIn(id, { energy: 1 }))).status).toBe(409);
    expect((await (await a.call('GET', '/api/check-ins')).json()).checkIns).toEqual([checkIn(id)]);
  });

  it('queries: número fixo com 1 e com 50 check ins', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    await database.db.checkIn.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({
        userId: big.id,
        date: new Date(Date.UTC(2026, 10, 1 + (i % 28))),
        period: 'tarde' as const,
        energy: 1 + (i % 5),
        createdAt: new Date(CREATED),
      })),
    });
    const id = uuid();
    await small.call('PUT', `/api/check-ins/${id}`, checkIn(id));

    const range = '?from=2026-11-01&to=2026-11-30';
    const get = await queriesOf(database, small, 'GET', `/api/check-ins${range}`);
    expect(await queriesOf(database, big, 'GET', `/api/check-ins${range}`)).toBe(get);
    expect(get).toBe(3);
    const put = await queriesOf(database, small, 'PUT', `/api/check-ins/${id}`, checkIn(id));
    const bigId = uuid();
    expect(await queriesOf(database, big, 'PUT', `/api/check-ins/${bigId}`, checkIn(bigId))).toBe(put);
    expect(put).toBe(3);
  });
});
