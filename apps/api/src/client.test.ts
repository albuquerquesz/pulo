// Prova de tipos ponta a ponta: o cliente `hc<AppType>` do Hono infere rotas, corpos e respostas da própria API.
// Os `expectTypeOf` são checados pelo `tsc` (npm run typecheck); o resto roda de verdade contra o app.
import type { FocusSession, Habit, MascotState, Streak, RestDay, RoutineBlock, WeekSummary } from '@pulo/core/domain/types';
import { type ApiErrorBody, apiErrorSchema } from '@pulo/core/api/schemas';
import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { hc } from 'hono/client';
import type { AppType } from './app';
import { TEST_NOW, TEST_ORIGIN, createHarness } from './testing';

let database: TestDatabase;
let h: ReturnType<typeof createHarness>;

beforeAll(async () => {
  database = await createTestDatabase();
  h = createHarness(database);
});
afterAll(async () => {
  await database.close();
});

async function typedClient() {
  const me = await h.newUser();
  const client = hc<AppType>('http://localhost', {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => h.app.request(input, init),
    headers: { cookie: me.cookie, origin: TEST_ORIGIN },
  });
  return client;
}

describe('hc<AppType>', () => {
  it('bloco, hábito e sessão com tipos inferidos da API', async () => {
    const client = await typedClient();
    const id = crypto.randomUUID();

    const blockRes = await client.api.blocks[':id'].$put({
      param: { id },
      json: { id, weekday: 2, startMinutes: 600, durationMinutes: 45, kind: 'foco', title: 'Escrever' },
    });
    const { block } = await blockRes.json();
    expectTypeOf(block).toEqualTypeOf<RoutineBlock>();
    expect(block).toEqual({ id, weekday: 2, startMinutes: 600, durationMinutes: 45, kind: 'foco', title: 'Escrever' });

    const listed = await (await client.api.blocks.$get()).json();
    expectTypeOf(listed.blocks).toEqualTypeOf<RoutineBlock[]>();

    const habitId = crypto.randomUUID();
    const habitRes = await client.api.habits[':id'].$put({
      param: { id: habitId },
      json: { id: habitId, title: 'Ler', weekdays: [0, 1], state: 'ativo' },
    });
    expectTypeOf((await habitRes.json()).habit).toExtend<Habit & { active: boolean }>();

    const sessionId = crypto.randomUUID();
    const sessionRes = await client.api.sessions[':id'].$put({
      param: { id: sessionId },
      json: { id: sessionId, startedAt: TEST_NOW - 1000, endedAt: TEST_NOW, plannedMinutes: 25, state: 'interrompida', pausedMs: 0 },
    });
    const written = await sessionRes.json();
    expectTypeOf(written.session).toEqualTypeOf<FocusSession>();
    expectTypeOf(written.mascot).toEqualTypeOf<MascotState | null>();
    expect(written.session.state).toBe('interrompida');
  });

  it('consultas tipadas: descanso, resumo da semana e sync', async () => {
    const client = await typedClient();

    const rest = await (await client.api['rest-days'][':date'].$put({ param: { date: '2026-11-18' } })).json();
    expectTypeOf(rest.restDay).toEqualTypeOf<RestDay>();
    expectTypeOf(rest.mascot).toEqualTypeOf<MascotState>();

    const summary = await (await client.api['week-summary'].$get({ query: { date: '2026-11-18' } })).json();
    expectTypeOf(summary.summary).toEqualTypeOf<WeekSummary>();
    expect(summary.summary.restDays).toBe(1);

    const sync = await (await client.api.sync.$get({ query: { from: '2026-11-01', to: '2026-11-30' } })).json();
    expectTypeOf(sync.blocks).toEqualTypeOf<RoutineBlock[]>();
    expectTypeOf(sync.mascot).toEqualTypeOf<MascotState | null>();
    expectTypeOf(sync.streak).toEqualTypeOf<Streak>();
    expect(sync.restDays).toEqual([{ date: '2026-11-18' }]);
  });

  it('erros têm o formato ApiErrorBody', async () => {
    const client = await typedClient();
    const res = await client.api.blocks[':id'].$put({
      param: { id: 'x' },
      json: { id: 'y', weekday: 0, startMinutes: 0, durationMinutes: 50, kind: 'foco' },
    });
    expect(res.status).toBe(400);
    // O corpo de erro é validado com o schema do contrato, o mesmo que o app usa.
    const body: ApiErrorBody = apiErrorSchema.parse(await res.json());
    expect(body.error).toBe('id_divergente');
  });
});
