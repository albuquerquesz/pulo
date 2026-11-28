import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { TEST_ORIGIN, createHarness, queriesOf } from '../testing';

let database: TestDatabase;
let h: ReturnType<typeof createHarness>;

beforeAll(async () => {
  database = await createTestDatabase();
  h = createHarness(database);
});
afterAll(async () => {
  await database.close();
});

const block = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  weekday: 1,
  startMinutes: 540,
  durationMinutes: 50,
  kind: 'foco',
  ...extra,
});
const uuid = () => crypto.randomUUID();

describe('/api/blocks', () => {
  it('exige sessão em todas as rotas', async () => {
    for (const [method, path] of [
      ['GET', '/api/blocks'],
      ['PUT', `/api/blocks/${uuid()}`],
      ['DELETE', `/api/blocks/${uuid()}`],
    ] as const) {
      const res = await h.app.request(path, { method });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'nao_autenticado', message: 'Entre na sua conta para continuar.' });
    }
  });

  it('cria, lê, atualiza (idempotente) e apaga', async () => {
    const me = await h.newUser();
    const id = uuid();
    const first = await me.call('PUT', `/api/blocks/${id}`, block(id, { title: 'Estudar' }));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ block: block(id, { title: 'Estudar' }) });

    // Repetir o mesmo PUT não duplica; mudar atualiza.
    await me.call('PUT', `/api/blocks/${id}`, block(id, { title: 'Estudar' }));
    await me.call('PUT', `/api/blocks/${id}`, block(id, { durationMinutes: 25, kind: 'descanso' }));
    const list = await (await me.call('GET', '/api/blocks')).json();
    expect(list.blocks).toEqual([block(id, { durationMinutes: 25, kind: 'descanso' })]);

    const del = await me.call('DELETE', `/api/blocks/${id}`);
    expect(await del.json()).toEqual({ deleted: 1 });
    expect((await (await me.call('GET', '/api/blocks')).json()).blocks).toEqual([]);
    // Apagar de novo é idempotente.
    expect(await (await me.call('DELETE', `/api/blocks/${id}`)).json()).toEqual({ deleted: 0 });
  });

  it('valida duração de 5 a 120, dia, horário e id divergente', async () => {
    const me = await h.newUser();
    const id = uuid();
    for (const bad of [
      block(id, { durationMinutes: 4 }),
      block(id, { durationMinutes: 121 }),
      block(id, { weekday: 7 }),
      block(id, { startMinutes: 1430, durationMinutes: 30 }),
      block(id, { kind: 'outro' }),
      block(id, { title: '' }),
    ]) {
      const res = await me.call('PUT', `/api/blocks/${id}`, bad);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('corpo_invalido');
    }
    expect(block(id).durationMinutes).toBe(50);
    expect((await me.call('PUT', `/api/blocks/${id}`, block(id, { durationMinutes: 5 }))).status).toBe(200);
    expect((await me.call('PUT', `/api/blocks/${id}`, block(id, { durationMinutes: 120 }))).status).toBe(200);
    const mismatch = await me.call('PUT', `/api/blocks/${uuid()}`, block(id));
    expect(mismatch.status).toBe(400);
    expect((await mismatch.json()).error).toBe('id_divergente');
    expect((await me.call('PUT', '/api/blocks/id%20ruim', block('id ruim'))).status).toBe(400);
  });

  it('recusa JSON quebrado com corpo_invalido', async () => {
    const me = await h.newUser();
    const res = await h.app.request(`/api/blocks/${uuid()}`, {
      method: 'PUT',
      headers: { cookie: me.cookie, origin: TEST_ORIGIN, 'content-type': 'application/json' },
      body: '{quebrado',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('corpo_invalido');
  });

  it('isolamento: outra pessoa não lê, não sobrescreve e não apaga', async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    const id = uuid();
    await a.call('PUT', `/api/blocks/${id}`, block(id, { title: 'da A' }));

    expect((await (await b.call('GET', '/api/blocks')).json()).blocks).toEqual([]);
    const steal = await b.call('PUT', `/api/blocks/${id}`, block(id, { title: 'da B' }));
    expect(steal.status).toBe(409);
    expect((await steal.json()).error).toBe('conflito_de_id');
    expect(await (await b.call('DELETE', `/api/blocks/${id}`)).json()).toEqual({ deleted: 0 });

    expect((await (await a.call('GET', '/api/blocks')).json()).blocks).toEqual([block(id, { title: 'da A' })]);
  });

  it('queries: número fixo com 1 e com 50 blocos', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    await database.db.routineBlock.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({
        userId: big.id,
        weekday: i % 7,
        startMinutes: i * 10,
        durationMinutes: 30,
        kind: 'foco' as const,
      })),
    });
    const id = uuid();
    await small.call('PUT', `/api/blocks/${id}`, block(id));

    const get = await queriesOf(database, small, 'GET', '/api/blocks');
    expect(await queriesOf(database, big, 'GET', '/api/blocks')).toBe(get);
    expect(get).toBe(3);

    const put = await queriesOf(database, small, 'PUT', `/api/blocks/${id}`, block(id));
    const bigId = uuid();
    expect(await queriesOf(database, big, 'PUT', `/api/blocks/${bigId}`, block(bigId))).toBe(put);
    // 2 de sessão + trava + leitura + upsert.
    expect(put).toBe(5);

    const del = await queriesOf(database, small, 'DELETE', `/api/blocks/${id}`);
    expect(await queriesOf(database, big, 'DELETE', `/api/blocks/${bigId}`)).toBe(del);
    expect(del).toBe(3);
  });
});
