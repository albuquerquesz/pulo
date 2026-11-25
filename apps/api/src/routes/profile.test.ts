// O que o Perfil vê: preferências no sync, modo férias na sequência, estatísticas e conexões.
import { DEFAULT_PREFERENCES } from '@pulo/core/domain/user-metadata';
import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { seedEverything } from '../account-fixtures';
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
afterEach(() => h.setNow(TEST_NOW));

const DAY = 86_400_000;
const sync = async (user: TestUser) => (await user.call('GET', '/api/sync?from=2026-01-01&to=2026-12-31')).json();
const patch = (user: TestUser, body: unknown) => user.call('PATCH', '/api/me/metadata', body);

describe('preferências', () => {
  it('conta nova lê os padrões; o que grava volta no sync', async () => {
    const me = await h.newUser();
    expect((await sync(me)).metadata).toMatchObject(DEFAULT_PREFERENCES);
    const prefs = {
      focusMinutes: 40,
      breakMinutes: 10,
      dailyFocusGoalMinutes: 90,
      eveningReminder: { ligado: true, minutos: 1200 },
      sounds: false,
      aiEnabled: false,
      ambientSound: 'chuva',
    };
    expect((await patch(me, prefs)).status).toBe(200);
    expect((await sync(me)).metadata).toMatchObject(prefs);
    await patch(me, { dailyFocusGoalMinutes: null });
    expect((await sync(me)).metadata).toMatchObject({ ...prefs, dailyFocusGoalMinutes: null });
  });

  it('recusa valores fora dos limites e datas de férias vindas do app', async () => {
    const me = await h.newUser();
    for (const body of [{ focusMinutes: 14 }, { focusMinutes: 51 }, { breakMinutes: 2 }, { dailyFocusGoalMinutes: 4 }, { eveningReminder: { ligado: true, minutos: 1440 } }, { ambientSound: 'mar' }, { vacation: { ligado: true, desde: '2020-01-01' } }]) {
      expect((await patch(me, body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it('férias: os dias contam como descanso, também depois de desligar', async () => {
    const me = await h.newUser();
    const sid = crypto.randomUUID();
    await me.call('PUT', `/api/sessions/${sid}`, { id: sid, startedAt: TEST_NOW - 30 * 60_000, endedAt: TEST_NOW - 5 * 60_000, plannedMinutes: 25, state: 'concluida', pausedMs: 0 });
    expect((await sync(me)).streak.atual).toBe(1);
    await patch(me, { vacation: { ligado: true } });
    h.setNow(TEST_NOW + 5 * DAY);
    expect((await sync(me)).streak).toMatchObject({ atual: 1, recorde: 1 });
    await patch(me, { vacation: { ligado: false } });
    const { metadata, streak } = await sync(me);
    expect(metadata.vacation).toMatchObject({ ligado: false, desde: null });
    expect(metadata.vacation.periodos).toHaveLength(1);
    expect(streak.atual).toBe(1);
    // Sem férias nem registro, os dias seguintes voltam a quebrar.
    h.setNow(TEST_NOW + 8 * DAY);
    expect((await (await me.call('GET', '/api/streak')).json()).streak.atual).toBe(0);
  });
});

describe('estatísticas', () => {
  it('sync e /api/stats somam todo o histórico, só da pessoa', async () => {
    const me = await h.newUser();
    const other = await h.newUser();
    await seedEverything(database, me.id, 'eu', 3);
    await seedEverything(database, other.id, 'outra', 5);
    const created = await database.db.user.findUniqueOrThrow({ where: { id: me.id }, select: { createdAt: true } });
    const expected = { habitosFeitos: 3, minutosDeFoco: 75, desde: created.createdAt.getTime() };
    // Intervalo curto: as estatísticas não dependem dele.
    const short = await (await me.call('GET', '/api/sync?from=2026-06-01&to=2026-06-02')).json();
    expect(short.stats).toEqual(expected);
    expect(await (await me.call('GET', '/api/stats')).json()).toEqual({ stats: expected });
  });

  it('exige sessão e usa um número fixo de queries', async () => {
    expect((await h.app.request('/api/stats')).status).toBe(401);
    const small = await h.newUser();
    const big = await h.newUser();
    await seedEverything(database, small.id, 's1');
    await seedEverything(database, big.id, 's50', 50);
    expect(await queriesOf(database, small, 'GET', '/api/stats')).toBe(4);
    expect(await queriesOf(database, big, 'GET', '/api/stats')).toBe(4);
  });
});

describe('/api/mcp/connections', () => {
  it('lista os aplicativos liberados e desconecta só o pedido, só da pessoa', async () => {
    expect((await h.app.request('/api/mcp/connections')).status).toBe(401);
    const me = await h.newUser();
    const other = await h.newUser();
    const mine = await seedEverything(database, me.id, 'liga');
    const theirs = await seedEverything(database, other.id, 'alheia');
    const list = await (await me.call('GET', '/api/mcp/connections')).json();
    expect(list).toEqual({ connections: [{ clientId: mine.clientId, name: 'Claude', scopes: ['openid'], connectedAt: TEST_NOW, updatedAt: TEST_NOW }] });

    // Pedir o cliente de outra pessoa não apaga nada.
    expect(await (await me.call('DELETE', `/api/mcp/connections/${theirs.clientId}`)).json()).toEqual({ deleted: 0 });
    expect(await database.db.oauthConsent.count({ where: { userId: other.id } })).toBe(1);

    expect(await (await me.call('DELETE', `/api/mcp/connections/${mine.clientId}`)).json()).toEqual({ deleted: 1 });
    expect(await (await me.call('GET', '/api/mcp/connections')).json()).toEqual({ connections: [] });
    expect(await database.db.oauthRefreshToken.count({ where: { userId: me.id } })).toBe(0);
    expect(await database.db.oauthAccessToken.count({ where: { userId: me.id } })).toBe(0);
    expect(await database.db.verification.count({ where: { value: { contains: me.id } } })).toBe(0);
    expect(await database.db.verification.count({ where: { value: { contains: other.id } } })).toBe(1);
  });

  it('queries: número fixo com 1 e com 50 aplicativos', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    await seedEverything(database, small.id, 'c1');
    const { clientId } = await seedEverything(database, big.id, 'c50');
    for (let i = 0; i < 49; i += 1) {
      const other = `c50-extra-${i}`;
      await database.db.oauthClient.create({ data: { id: other, clientId: other, redirectUris: [] } });
      await database.db.oauthConsent.create({ data: { id: `${other}-ok`, clientId: other, userId: big.id, scopes: [] } });
    }
    expect(await queriesOf(database, small, 'GET', '/api/mcp/connections')).toBe(3);
    expect(await queriesOf(database, big, 'GET', '/api/mcp/connections')).toBe(3);
    const one = await queriesOf(database, small, 'DELETE', '/api/mcp/connections/c1-cliente');
    expect(await queriesOf(database, big, 'DELETE', `/api/mcp/connections/${clientId}`)).toBe(one);
    expect(one).toBe(6);
  });
});
