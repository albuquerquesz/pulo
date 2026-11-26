// Conquistas (spec 14): destravadas pelas escritas, mostradas no sync e em GET /api/achievements.
import { ACHIEVEMENTS, HOUSE, ROOM_DECOR } from '@pulo/core/config/decisions';
import { addDays } from '@pulo/core/domain/day';
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
const TODAY = '2026-11-18';
const uuid = () => crypto.randomUUID();
const dayOf = (key: string) => new Date(`${key}T00:00:00Z`);

async function newHabit(user: TestUser) {
  const id = uuid();
  await user.call('PUT', `/api/habits/${id}`, { id, title: 'Ler', weekdays: [0, 1, 2, 3, 4, 5, 6], active: true });
  return id;
}
const logPath = (habitId: string, date: string) => `/api/habit-logs/${habitId}/${date}`;
const logBody = (habitId: string, date: string) => ({ habitId, date, doneAt: TEST_NOW - MIN });
const markDay = async (user: TestUser, habitId: string, date: string) =>
  (await user.call('PUT', logPath(habitId, date), logBody(habitId, date))).json();
/** `count` dias de hábito feito seguidos, terminando `back` dias antes de hoje, direto no banco. */
async function history(user: TestUser, habitId: string, count: number, back = 1) {
  await database.db.habitLog.createMany({
    data: Array.from({ length: count }, (_, i) => ({ userId: user.id, habitId, date: dayOf(addDays(TODAY, -back - i)), doneAt: new Date(TEST_NOW - MIN) })),
  });
}
const list = async (user: TestUser) => (await (await user.call('GET', '/api/achievements')).json()).achievements;
const find = async (user: TestUser, id: string) => (await list(user)).find((item: { id: string }) => item.id === id);
const session = (minutes: number, state = 'concluida') => ({
  id: uuid(), startedAt: TEST_NOW - 60 * MIN, endedAt: TEST_NOW - (60 - minutes) * MIN, plannedMinutes: 50, state, pausedMs: 0,
});
const putSession = async (user: TestUser, body: ReturnType<typeof session>) => (await user.call('PUT', `/api/sessions/${body.id}`, body)).json();
const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe('GET /api/achievements', () => {
  it('exige sessão', async () => {
    expect((await h.app.request('/api/achievements')).status).toBe(401);
  });

  it('conta nova: o catálogo inteiro sem nada conquistado, e a secreta sem nome', async () => {
    const all = await list(await h.newUser());
    expect(ids(all)).toEqual(ids([...ACHIEVEMENTS]));
    expect(all[0]).toEqual({ id: 'primeira-semana', nome: 'Primeira semana', emoji: '🔥', conquistada: false, progresso: 0, meta: 7 });
    expect(all.at(-1)).toEqual({ id: 'segredo', conquistada: false, progresso: 0, meta: 1 });
  });
});

describe('escritas que destravam', () => {
  it('hábito feito no sétimo dia: devolve primeira semana uma vez só, e ela não some', async () => {
    const me = await h.newUser();
    const habitId = await newHabit(me);
    await history(me, habitId, 5);
    expect((await markDay(me, habitId, addDays(TODAY, -6))).newAchievements).toEqual([]);

    const unlocked = {
      id: 'primeira-semana', nome: 'Primeira semana', emoji: '🔥', conquistada: true, conquistadaEm: TEST_NOW, progresso: 7, meta: 7,
    };
    expect((await markDay(me, habitId, TODAY)).newAchievements).toEqual([unlocked]);
    h.setNow(TEST_NOW + MIN);
    expect((await markDay(me, habitId, TODAY)).newAchievements).toEqual([]);
    h.setNow(TEST_NOW);
    expect(await database.db.achievement.count({ where: { userId: me.id } })).toBe(1);

    await me.call('DELETE', `/api/habits/${habitId}`);
    expect(await find(me, 'primeira-semana')).toEqual(unlocked);
    const sync = await (await me.call('GET', '/api/sync?from=2026-11-01&to=2026-11-30')).json();
    expect(sync.achievements).toEqual(await list(me));
  });

  it('foco: 49 minutos não, 50 sim; repetir não comemora de novo', async () => {
    const me = await h.newUser();
    expect((await putSession(me, session(49, 'interrompida'))).newAchievements).toEqual([]);
    expect(await find(me, 'foco-profundo')).toMatchObject({ conquistada: false, progresso: 49, meta: 50 });
    const full = session(50);
    expect(ids((await putSession(me, full)).newAchievements)).toEqual(['foco-profundo', 'primeiro-foco']);
    expect((await putSession(me, full)).newAchievements).toEqual([]);
  });

  it('foco em andamento não destrava nada, mesmo com histórico que já passa', async () => {
    const me = await h.newUser();
    await history(me, await newHabit(me), 7);
    const running = { id: uuid(), startedAt: TEST_NOW - MIN, plannedMinutes: 25, state: 'em_andamento', pausedMs: 0 };
    expect(await (await me.call('PUT', `/api/sessions/${running.id}`, running)).json()).toMatchObject({ newAchievements: [] });
    // Já passa, mas ainda não está gravada.
    expect(await find(me, 'primeira-semana')).toMatchObject({ conquistada: false, progresso: 7 });
  });

  it('tarefa feita, meta concluída, baú e decoração destravam as delas', async () => {
    const me = await h.newUser();
    await database.db.task.createMany({
      data: Array.from({ length: 9 }, (_, i) => ({
        id: uuid(), userId: me.id, title: 'Feita', status: 'feito' as const, position: i, createdAt: new Date(TEST_NOW - MIN), completedAt: new Date(TEST_NOW - MIN), priority: 'normal' as const, pomodorosEstimated: 1,
      })),
    });
    const task = { id: uuid(), title: 'Ler', status: 'afazer', position: 10, priority: 'normal', tags: [], pomodorosEstimated: 1, createdAt: TEST_NOW - MIN };
    const aberta = await (await me.call('PUT', `/api/tasks/${task.id}`, task)).json();
    expect(aberta.newAchievements).toEqual([]);
    const feita = await (await me.call('PUT', `/api/tasks/${task.id}`, { ...task, status: 'feito', completedAt: TEST_NOW - MIN })).json();
    expect(ids(feita.newAchievements)).toEqual(['dez-tarefas']);

    const marcos = Array.from({ length: 10 }, () => ({ id: uuid(), title: 'Passo', doneAt: TEST_NOW - MIN }));
    const goal = { id: uuid(), title: 'Correr', state: 'concluida', milestones: marcos, createdAt: TEST_NOW - MIN, completedAt: TEST_NOW - MIN };
    const concluida = await (await me.call('PUT', `/api/goals/${goal.id}`, goal)).json();
    expect(ids(concluida.newAchievements)).toEqual(['primeira-meta', 'dez-marcos']);

    await database.db.joiaCredit.create({ data: { userId: me.id, amount: 1000 } });
    const bau = await (await me.call('POST', `/api/goals/${goal.id}/chest`)).json();
    expect(ids(bau.newAchievements)).toEqual(['quinhentas-joias']);

    const itens = Object.entries(ROOM_DECOR.itemCost).slice(0, 5);
    const unlocked: string[][] = [];
    for (const [x, [item, cost]] of itens.entries()) {
      const body = { item, cost, createdAt: TEST_NOW - MIN, x, y: 0, rotation: 0 };
      const res = await (await me.call('PUT', `/api/room/${item}`, body)).json();
      unlocked.push(ids(res.newAchievements));
    }
    expect(unlocked).toEqual([[], [], [], [], ['quarto-decorado']]);

    const sync = await (await me.call('GET', '/api/sync?from=2026-11-01&to=2026-11-30')).json();
    expect(sync.achievements).toEqual(await list(me));
  });

  it('quarto dia de descanso', async () => {
    const me = await h.newUser();
    // Os três de antes entram direto no banco: pela API só dá para marcar o de hoje.
    await database.db.restDay.createMany({
      data: ['2026-11-01', '2026-11-03', '2026-11-05'].map((date) => ({ userId: me.id, date: dayOf(date) })),
    });
    const fourth = await (await me.call('PUT', `/api/rest-days/${TODAY}`)).json();
    expect(ids(fourth.newAchievements)).toEqual(['descanso-sabido']);
  });

  it('descanso que emenda dois trechos destrava o mês de fogo e a primeira semana juntos', async () => {
    const me = await h.newUser();
    const habitId = await newHabit(me);
    await history(me, habitId, 15, 0);
    await history(me, habitId, 15, 16);
    await database.db.restDay.create({ data: { userId: me.id, date: dayOf(addDays(TODAY, -15)) } });
    const res = await markDay(me, habitId, TODAY);
    expect(ids(res.newAchievements)).toEqual(['primeira-semana', 'mes-de-fogo', 'habito-firme']);
  });

  it('a última parte da casa destrava casa inteira', async () => {
    const me = await h.newUser();
    await database.db.joiaCredit.create({ data: { userId: me.id, amount: 1000 } });
    await database.db.joiaCredit.update({ where: { userId: me.id }, data: { amount: 12000 } });
    const unlocked: Record<string, string[]> = {};
    // A ordem do catálogo não respeita os requisitos: compra o que já está liberado, em voltas.
    const faltam = HOUSE.parts.filter((p) => p.custo > 0);
    const prontas = new Set(['quarto']);
    while (faltam.length > 0) {
      const indice = faltam.findIndex((p) => !p.requer || prontas.has(p.requer));
      const [parte] = faltam.splice(indice, 1);
      if (!parte) throw new Error('requisito sem saída');
      const { id: item, custo: cost } = parte;
      const res = await (await me.call('PUT', `/api/house/${item}`, { item, cost, createdAt: TEST_NOW - MIN })).json();
      prontas.add(item);
      if (res.newAchievements.length > 0) unlocked[item] = ids(res.newAchievements);
    }
    expect(unlocked).toEqual({
      // O crédito de joias do teste já passa de 500: sai na primeira compra.
      cozinha: ['quinhentas-joias'],
      'segundo-andar': ['dois-andares'],
      escritorio: ['cinco-comodos'],
      piscina: ['casa-inteira'],
    });
  });

  it('duas escritas simultâneas comemoram uma vez só', async () => {
    const me = await h.newUser();
    await database.db.restDay.createMany({
      data: ['2026-11-01', '2026-11-03', '2026-11-05'].map((date) => ({ userId: me.id, date: dayOf(date) })),
    });
    const habitId = await newHabit(me);
    await database.db.restDay.create({ data: { userId: me.id, date: dayOf('2026-11-07') } });
    const results = await Promise.all([markDay(me, habitId, TODAY), markDay(me, habitId, addDays(TODAY, -1))]);
    expect(results.flatMap((r) => ids(r.newAchievements))).toEqual(['descanso-sabido']);
  });

  it('cada pessoa só vê as dela, e apagar os dados leva as conquistas', async () => {
    const me = await h.newUser();
    const other = await h.newUser();
    expect(ids((await putSession(me, session(50))).newAchievements)).toEqual(['foco-profundo', 'primeiro-foco']);
    expect(await find(other, 'foco-profundo')).toMatchObject({ conquistada: false, progresso: 0 });
    expect((await (await me.call('DELETE', '/api/data')).json()).deleted).toMatchObject({ achievements: 2 });
    expect(await find(me, 'foco-profundo')).toMatchObject({ conquistada: false, progresso: 0 });
  });

  it('queries: número fixo com 1 e com 50 registros, e um INSERT a mais ao destravar', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    const smallHabit = await newHabit(small);
    const bigHabit = await newHabit(big);
    await history(small, smallHabit, 1);
    await history(big, bigHabit, 50);
    // Grava o que o histórico já dá, para os dois ficarem sem nada novo.
    await markDay(big, bigHabit, addDays(TODAY, -1));
    // E acerta o gelo dos dois, que só grava na primeira vez do dia.
    await markDay(small, smallHabit, addDays(TODAY, 0));

    const get = await queriesOf(database, small, 'GET', '/api/achievements');
    expect(await queriesOf(database, big, 'GET', '/api/achievements')).toBe(get);
    expect(get).toBe(14);

    const put = await queriesOf(database, small, 'PUT', logPath(smallHabit, TODAY), logBody(smallHabit, TODAY));
    expect(await queriesOf(database, big, 'PUT', logPath(bigHabit, TODAY), logBody(bigHabit, TODAY))).toBe(put);
    expect(put).toBe(18);

    const fresh = await h.newUser();
    const freshHabit = await newHabit(fresh);
    await history(fresh, freshHabit, 40);
    expect(await queriesOf(database, fresh, 'PUT', logPath(freshHabit, TODAY), logBody(freshHabit, TODAY))).toBe(20);
  });
});
