import { metricsResponseSchema } from '@pulo/core/api/schemas';
import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { TEST_NOW, createHarness } from '../testing';

let database: TestDatabase;
let h: ReturnType<typeof createHarness>;

beforeAll(async () => {
  database = await createTestDatabase();
  h = createHarness(database);
});
afterAll(async () => {
  await database.close();
});

describe('GET /api/profile/metrics', () => {
  it('exige sessão', async () => {
    expect((await h.app.request('/api/profile/metrics')).status).toBe(401);
  });

  it('devolve os números da pessoa no formato do contrato', async () => {
    const me = await h.newUser();
    const end = new Date(TEST_NOW);
    await database.db.focusSession.create({
      data: { id: crypto.randomUUID(), userId: me.id, startedAt: new Date(TEST_NOW - 25 * 60_000), endedAt: end, plannedMinutes: 25, state: 'concluida' },
    });
    await database.db.restDay.create({ data: { userId: me.id, date: new Date('2026-11-17') } });
    await database.db.task.create({
      data: { id: crypto.randomUUID(), userId: me.id, title: 't', status: 'feito', position: 1, priority: 'normal', tags: [], pomodorosEstimated: 0, createdAt: end, completedAt: end },
    });
    const body = metricsResponseSchema.parse(await (await me.call('GET', '/api/profile/metrics')).json());
    expect(body.metrics).toMatchObject({
      descanso: { total: 1, noMes: 1, semanasComDescanso: 1, focoMedioSemanaComDescanso: null, focoMedioSemanaSem: null },
      gelo: { usadosTotal: 0, guardados: 1 },
      ritmo: { sessoesTerminadas: 1 },
      // 5 joias do foco e 2 do descanso.
      feitos: { tarefasConcluidas: 1, metasConcluidas: 0, joiasGanhas: 7 },
    });
    const other = await h.newUser();
    expect((await (await other.call('GET', '/api/profile/metrics')).json()).metrics.feitos.joiasGanhas).toBe(0);
  });
});
