// Escritas ao mesmo tempo e pedidos que chegam depois de uma mudança em outro aparelho.
import { DESCANSO, FOCUS } from '@pulo/core/config/decisions';
import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { createApp } from '../app';
import { TEST_NOW, createHarness, testEnv } from '../testing';

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
const running = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  startedAt: TEST_NOW - FOCUS.defaultMinutes * 60_000,
  plannedMinutes: FOCUS.defaultMinutes,
  state: 'em_andamento',
  pausedMs: 0,
  ...extra,
});
const bloco = (id: string, startMinutes: number) => ({ id, weekday: 0, startMinutes, durationMinutes: 60, kind: 'foco' });

describe('concorrência', () => {
  it('concluir e reabrir ao mesmo tempo: o foco encerrado não volta', async () => {
    const me = await h.newUser();
    const id = uuid();
    await me.call('PUT', `/api/sessions/${id}`, running(id));
    await Promise.all([
      me.call('PUT', `/api/sessions/${id}`, running(id, { state: 'concluida', endedAt: TEST_NOW })),
      me.call('PUT', `/api/sessions/${id}`, running(id, { pausedMs: 1000 })),
    ]);
    const row = await database.db.focusSession.findFirstOrThrow({ where: { id } });
    const late = await me.call('PUT', `/api/sessions/${id}`, running(id));
    if (row.state === 'concluida') expect(late.status).toBe(409);
    expect((await database.db.focusSession.findFirstOrThrow({ where: { id } })).state).toBe(row.state);
  });

  it('dois focos começados ao mesmo tempo: um vence, o outro recebe conflito de foco', async () => {
    const me = await h.newUser();
    const results = await Promise.all([uuid(), uuid(), uuid()].map((id) => me.call('PUT', `/api/sessions/${id}`, running(id))));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    for (const res of results.filter((r) => r.status !== 200)) {
      expect(res.status).toBe(409);
      expect(['sessao_em_andamento', 'conflito_concorrente']).toContain((await res.json()).error);
    }
  });

  it('o índice do foco ativo vira sessao_em_andamento', async () => {
    const me = await h.newUser();
    const row = { userId: me.id, startedAt: new Date(TEST_NOW), plannedMinutes: 25, state: 'em_andamento' as const };
    await database.db.focusSession.create({ data: { ...row, id: uuid() } });
    const error: unknown = await database.db.focusSession.create({ data: { ...row, id: uuid() } }).catch((e: unknown) => e);
    expect(JSON.stringify(error)).toContain('focus_session_one_active_per_user');
  });

  it('bloco apagado com o foco rodando: o pedido que ainda o cita conclui o foco', async () => {
    const me = await h.newUser();
    const [id, blockId] = [uuid(), uuid()];
    await me.call('PUT', `/api/blocks/${blockId}`, bloco(blockId, 0));
    expect((await me.call('PUT', `/api/sessions/${id}`, running(id, { blockId }))).status).toBe(200);
    await me.call('DELETE', `/api/blocks/${blockId}`);
    const end = await me.call('PUT', `/api/sessions/${id}`, running(id, { blockId, state: 'concluida', endedAt: TEST_NOW }));
    expect(end.status).toBe(200);
    expect((await end.json()).session.blockId).toBeUndefined();
  });

  it('descansos ao mesmo tempo não passam do limite da semana', async () => {
    const me = await h.newUser();
    await Promise.all(Array.from({ length: DESCANSO.maxPorSemana + 3 }, () => me.call('PUT', '/api/rest-days/2026-11-18')));
    expect(await database.db.restDay.count({ where: { userId: me.id } })).toBeLessThanOrEqual(DESCANSO.maxPorSemana);
  });

  it('duas mudanças de preferências ao mesmo tempo ficam as duas', async () => {
    const me = await h.newUser();
    await Promise.all([
      me.call('PATCH', '/api/me/metadata', { focusMinutes: 40 }),
      me.call('PATCH', '/api/me/metadata', { breakMinutes: 10 }),
    ]);
    expect((await (await me.call('GET', '/api/me')).json()).metadata).toMatchObject({ focusMinutes: 40, breakMinutes: 10 });
  });

  it('bloco sobreposto é recusado, no lote e sozinho, inclusive ao mesmo tempo', async () => {
    const me = await h.newUser();
    const put = (id: string, start: number) => me.call('PUT', `/api/blocks/${id}`, bloco(id, start));
    const first = uuid();
    expect((await put(first, 600)).status).toBe(200);
    const clash = await put(uuid(), 630);
    expect(clash.status).toBe(409);
    expect((await clash.json()).error).toBe('horario_ocupado');
    const batch = await me.call('PUT', '/api/blocks', { blocks: [bloco(uuid(), 800), bloco(uuid(), 830)] });
    expect(batch.status).toBe(409);
    const both = await Promise.all([put(uuid(), 900), put(uuid(), 900)]);
    expect(both.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await database.db.routineBlock.count({ where: { userId: me.id } })).toBe(2);
  });

  it('um ambiente de IA mal configurado não derruba a API', async () => {
    const app = createApp({ ...testEnv, PULO_AI_PROVIDER: 'inexistente' }, database.db, () => TEST_NOW);
    expect((await app.request('/health')).status).toBe(200);
  });
});
