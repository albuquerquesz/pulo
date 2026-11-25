import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { seedEverything, userTables } from '../account-fixtures';
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

/** Onde cada tabela com `userId` aparece no arquivo. `null` = de propósito fora (login e OAuth). */
const WHERE_IN_FILE: Record<string, string | null> = {
  routine_block: 'blocks',
  habit: 'habits',
  habit_log: 'habitLogs',
  focus_session: 'sessions',
  rest_day: 'restDays',
  weekly_proposal: 'proposals',
  goal: 'goals',
  goal_chest: 'goalChests',
  task: 'tasks',
  task_subtask: 'subtasks',
  task_comment: 'taskComments',
  task_event: 'taskEvents',
  task_counter: 'lastTaskNumber',
  island_purchase: 'housePurchases',
  room_placement: 'roomDecor',
  joia_credit: 'joiaCredit',
  mascot_state: 'mascot',
  oauth_consent: 'connections',
  session: null,
  account: null,
  oauth_client: null,
  oauth_refresh_token: null,
  oauth_access_token: null,
};

describe('GET /api/data/export', () => {
  it('exige sessão', async () => {
    expect((await h.app.request('/api/data/export')).status).toBe(401);
  });

  it('toda tabela com userId foi decidida: está no arquivo ou fora de propósito', async () => {
    expect(await userTables(database)).toEqual(Object.keys(WHERE_IN_FILE).sort());
  });

  it('traz tudo da pessoa, sem token, segredo, sessão nem nada de outra', async () => {
    const me = await h.newUser();
    const other = await h.newUser();
    await seedEverything(database, me.id, 'minha');
    await seedEverything(database, other.id, 'dela');

    const res = await me.call('GET', '/api/data/export');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="pulo-dados-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const text = await res.text();
    const file = JSON.parse(text);
    for (const key of Object.values(WHERE_IN_FILE)) {
      if (key === null) continue;
      const value = file[key];
      expect(Array.isArray(value) ? value.length : value, key).toBeTruthy();
    }
    expect(file).toMatchObject({
      exportVersion: 1,
      user: { id: me.id },
      metadata: { focusMinutes: 25 },
      lastTaskNumber: 1,
      joiaCredit: 7,
      islandPurchases: [{ item: 'banco' }],
      housePurchases: [{ item: 'cerca' }],
      roomDecor: [{ item: 'tapete', x: 1, y: 2, rotation: 90 }],
      connections: [{ name: 'Claude', scopes: ['openid'] }],
    });
    expect(text).not.toContain('SEGREDO');
    expect(text).not.toContain(me.cookie.split('=')[1].split('.')[0]);
    expect(text).not.toContain('dela-');
    expect(text).not.toContain(other.id);
    expect(text).not.toMatch(/token|password|clientSecret|ipAddress|userAgent/i);
  });

  it('queries: número fixo com 1 e com 50 registros', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    await seedEverything(database, small.id, 'um');
    await seedEverything(database, big.id, 'cinquenta', 50);
    const one = await queriesOf(database, small, 'GET', '/api/data/export');
    expect(await queriesOf(database, big, 'GET', '/api/data/export')).toBe(one);
    // 2 de sessão, 16 leituras numa transação e as conexões.
    expect(one).toBe(20);
  });
});
