import { FOCUS } from '@pulo/core/config/decisions';
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

const MIN = 60_000;
const uuid = () => crypto.randomUUID();
const running = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  startedAt: TEST_NOW - 25 * MIN,
  plannedMinutes: 25,
  state: 'em_andamento',
  pausedMs: 0,
  ...extra,
});
const finished = (id: string, extra: Record<string, unknown> = {}) =>
  running(id, { state: 'concluida', endedAt: TEST_NOW, ...extra });
const put = (user: TestUser, body: { id: string }) => user.call('PUT', `/api/sessions/${body.id}`, body);
const listOf = async (user: TestUser, query = '') => (await (await user.call('GET', `/api/sessions${query}`)).json()).sessions;

describe('/api/sessions', () => {
  it('exige sessão', async () => {
    expect((await h.app.request('/api/sessions')).status).toBe(401);
    expect((await h.app.request(`/api/sessions/${uuid()}`, { method: 'PUT' })).status).toBe(401);
  });

  it('ciclo completo: inicia, pausa, retoma e conclui, e o sapo ganha um dia de cuidado', async () => {
    const me = await h.newUser();
    const id = uuid();
    const start = await put(me, running(id));
    expect(start.status).toBe(200);
    expect(await start.json()).toEqual({ session: running(id), mascot: null });

    // Repetir é idempotente; pausar e retomar atualizam a mesma sessão.
    await put(me, running(id));
    const paused = await put(me, running(id, { pausedSince: TEST_NOW - 10 * MIN }));
    expect((await paused.json()).session.pausedSince).toBe(TEST_NOW - 10 * MIN);
    await put(me, running(id, { pausedMs: 2 * MIN }));

    const end = await put(me, finished(id, { pausedMs: 2 * MIN }));
    expect(end.status).toBe(200);
    expect(await end.json()).toEqual({
      session: finished(id, { pausedMs: 2 * MIN }),
      mascot: { phase: 1, careDays: 1, updatedAt: TEST_NOW },
    });
    expect((await (await me.call('GET', '/api/mascot')).json()).mascot).toMatchObject({ careDays: 1 });
    expect(await listOf(me)).toEqual([finished(id, { pausedMs: 2 * MIN })]);
  });

  it('interrompida cedo demais não conta como cuidado; a fase não regride', async () => {
    const me = await h.newUser();
    const id = uuid();
    await put(me, running(id));
    const early = await put(me, finished(id, { state: 'interrompida', endedAt: TEST_NOW - 20 * MIN }));
    expect((await early.json()).mascot).toMatchObject({ phase: 1, careDays: 0 });

    // Três dias de cuidado levam à fase 2; apagar as sessões do banco não faz o sapo regredir.
    for (const day of [1, 2, 3]) {
      const sid = uuid();
      const endedAt = TEST_NOW - day * 24 * 60 * MIN;
      await put(me, finished(sid, { startedAt: endedAt - 25 * MIN, endedAt }));
    }
    expect((await (await me.call('GET', '/api/mascot')).json()).mascot).toMatchObject({ phase: 2, careDays: 3 });
    await database.db.focusSession.deleteMany({ where: { userId: me.id } });
    const sid = uuid();
    const again = await put(me, finished(sid, { startedAt: TEST_NOW - 90 * MIN, endedAt: TEST_NOW - 60 * MIN }));
    expect((await again.json()).mascot).toMatchObject({ phase: 2, careDays: 3 });
  });

  it('no máximo uma sessão em andamento por pessoa (409), mesmo com a outra pausada', async () => {
    const me = await h.newUser();
    const first = uuid();
    await put(me, running(first, { pausedSince: TEST_NOW - MIN }));
    const second = await put(me, running(uuid()));
    expect(second.status).toBe(409);
    expect((await second.json()).error).toBe('sessao_em_andamento');
    expect(await listOf(me)).toHaveLength(1);

    // Encerrada a primeira, outra pode começar.
    await put(me, finished(first));
    expect((await put(me, running(uuid(), { startedAt: TEST_NOW - MIN }))).status).toBe(200);
    // E cada pessoa tem a sua.
    const other = await h.newUser();
    expect((await put(other, running(uuid()))).status).toBe(200);
  });

  it('sessão encerrada é imutável: mudar dá 409, repetir igual é idempotente', async () => {
    const me = await h.newUser();
    const id = uuid();
    await put(me, running(id));
    await put(me, finished(id));
    const changes = [
      finished(id, { state: 'interrompida' }),
      finished(id, { endedAt: TEST_NOW - MIN }),
      running(id),
      finished(id, { pausedMs: 1000 }),
    ];
    for (const change of changes) {
      const res = await put(me, change);
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('sessao_encerrada');
    }
    const same = await put(me, finished(id));
    expect(same.status).toBe(200);
    expect((await same.json()).mascot).toMatchObject({ careDays: 1 });
    expect(await listOf(me)).toEqual([finished(id)]);
  });

  it('início, duração planejada e bloco não mudam enquanto em andamento', async () => {
    const me = await h.newUser();
    const id = uuid();
    await put(me, running(id));
    for (const change of [running(id, { plannedMinutes: 30 }), running(id, { startedAt: TEST_NOW - 5 * MIN })]) {
      const res = await put(me, change);
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('sessao_imutavel');
    }
  });

  it(`valida o planejado de ${FOCUS.minMinutes} a ${FOCUS.maxMinutes} minutos e a coerência dos tempos`, async () => {
    const me = await h.newUser();
    const id = uuid();
    const bad = [
      running(id, { plannedMinutes: FOCUS.minMinutes - 1 }),
      running(id, { plannedMinutes: FOCUS.maxMinutes + 1 }),
      running(id, { plannedMinutes: 25.5 }),
      running(id, { endedAt: TEST_NOW }),
      finished(id, { endedAt: undefined }),
      finished(id, { endedAt: TEST_NOW - 60 * MIN }),
      finished(id, { pausedSince: TEST_NOW - MIN }),
      finished(id, { pausedMs: 10 * 60 * MIN }),
      running(id, { pausedMs: -1 }),
      running(id, { state: 'pausada' }),
    ];
    for (const body of bad) {
      const res = await put(me, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect((await res.json()).error).toBe('corpo_invalido');
    }
    for (const plannedMinutes of [FOCUS.minMinutes, FOCUS.maxMinutes]) {
      const sid = uuid();
      const body = finished(sid, { plannedMinutes, startedAt: TEST_NOW - 60 * MIN });
      expect((await put(me, body)).status).toBe(200);
    }
    const future = await put(me, running(uuid(), { startedAt: TEST_NOW + 60 * MIN }));
    expect((await future.json()).error).toBe('horario_no_futuro');
    const mismatch = await me.call('PUT', `/api/sessions/${uuid()}`, running(id));
    expect((await mismatch.json()).error).toBe('id_divergente');
  });

  it('bloco: precisa ser da própria pessoa; apagar o bloco mantém a sessão', async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    const blockId = uuid();
    await a.call('PUT', `/api/blocks/${blockId}`, { id: blockId, weekday: 1, startMinutes: 540, durationMinutes: 30, kind: 'foco' });

    const foreign = await put(b, running(uuid(), { blockId }));
    expect(foreign.status).toBe(404);
    expect((await foreign.json()).error).toBe('referencia_inexistente');
    expect((await put(a, running(uuid(), { blockId: uuid() }))).status).toBe(404);

    const id = uuid();
    expect((await put(a, finished(id, { blockId }))).status).toBe(200);
    await a.call('DELETE', `/api/blocks/${blockId}`);
    expect(await listOf(a)).toEqual([finished(id)]);
  });

  it('GET filtra pelo dia lógico de término e sempre traz a sessão em andamento', async () => {
    const me = await h.newUser();
    const oldId = uuid();
    const weekId = uuid();
    const activeId = uuid();
    const day = (n: number) => TEST_NOW - n * 24 * 60 * MIN;
    await put(me, finished(oldId, { startedAt: day(30) - 25 * MIN, endedAt: day(30) }));
    await put(me, finished(weekId, { startedAt: day(1) - 25 * MIN, endedAt: day(1) }));
    await put(me, running(activeId));

    const ids = async (query: string) => (await listOf(me, query)).map((s: { id: string }) => s.id);
    expect(await ids('')).toEqual([oldId, weekId, activeId]);
    // 2026-11-17 (ontem) e a sessão ativa; a de 30 dias atrás fica de fora.
    expect(await ids('?from=2026-11-16&to=2026-11-17')).toEqual([weekId, activeId]);
    expect(await ids('?from=2026-10-01&to=2026-10-31')).toEqual([oldId, activeId]);
    expect((await me.call('GET', '/api/sessions?from=nao&to=nao')).status).toBe(400);
  });

  it('isolamento: outra pessoa não lê nem altera sessões alheias', async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    const id = uuid();
    await put(a, running(id));
    await put(a, finished(id));

    expect(await listOf(b)).toEqual([]);
    const steal = await put(b, running(id, { startedAt: TEST_NOW - MIN }));
    expect(steal.status).toBe(409);
    expect((await steal.json()).error).toBe('conflito_de_id');
    expect(await listOf(a)).toEqual([finished(id)]);
    // O sapo de B não é afetado pelas sessões de A.
    expect((await (await b.call('GET', '/api/mascot')).json()).mascot).toBeNull();
  });

  it('queries: número fixo com 1 e com 50 sessões', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    await database.db.focusSession.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({
        userId: big.id,
        startedAt: new Date(TEST_NOW - (i + 2) * 24 * 60 * MIN),
        endedAt: new Date(TEST_NOW - (i + 2) * 24 * 60 * MIN + 25 * MIN),
        plannedMinutes: 25,
        state: 'concluida' as const,
      })),
    });
    await put(small, finished(uuid(), { startedAt: TEST_NOW - 3 * 24 * 60 * MIN, endedAt: TEST_NOW - 3 * 24 * 60 * MIN + 25 * MIN }));

    const range = '?from=2026-01-01&to=2026-12-31';
    const get = await queriesOf(database, small, 'GET', `/api/sessions${range}`);
    expect(await queriesOf(database, big, 'GET', `/api/sessions${range}`)).toBe(get);
    expect(get).toBe(3);

    const startId = { small: uuid(), big: uuid() };
    const start = await queriesOf(database, small, 'PUT', `/api/sessions/${startId.small}`, running(startId.small));
    expect(await queriesOf(database, big, 'PUT', `/api/sessions/${startId.big}`, running(startId.big))).toBe(start);
    // 2 de sessão + leitura (1) + upsert (1).
    expect(start).toBe(4);

    const finish = await queriesOf(database, small, 'PUT', `/api/sessions/${startId.small}`, finished(startId.small));
    expect(await queriesOf(database, big, 'PUT', `/api/sessions/${startId.big}`, finished(startId.big))).toBe(finish);
    // 2 de sessão + leitura + upsert + (sessões, descansos, sapo, upsert do sapo).
    expect(finish).toBe(8);
  });
});
