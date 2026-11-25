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
const sessionOf = async (response: Response) => (await response.json()).session;

async function targets(userId: string) {
  const habit = await database.db.habit.create({ data: { userId, title: 'ler', weekdays: [0] }, select: { id: true } });
  const goal = await database.db.goal.create({
    data: { userId, title: 'meta', state: 'ativa', milestones: [], createdAt: new Date(TEST_NOW) },
    select: { id: true },
  });
  const task = await database.db.task.create({
    data: { userId, number: 1, title: 't', status: 'afazer', position: 1, priority: 'normal', tags: [], pomodorosEstimated: 2, createdAt: new Date(TEST_NOW) },
    select: { id: true },
  });
  return { habitId: habit.id, goalId: goal.id, taskId: task.id };
}

describe('/api/sessions: intenção e vínculo', () => {
  it('grava e devolve a intenção aparada e o vínculo, um de cada tipo', async () => {
    const me = await h.newUser();
    for (const [key, id] of Object.entries(await targets(me.id))) {
      const sid = uuid();
      const response = await put(me, finished(sid, { intention: '  Capítulo 2 ', [key]: id }));
      expect(response.status).toBe(200);
      expect(await sessionOf(response)).toEqual(finished(sid, { intention: 'Capítulo 2', [key]: id }));
    }
  });

  it('dois alvos, intenção vazia ou longa demais: 400', async () => {
    const me = await h.newUser();
    const { habitId, goalId } = await targets(me.id);
    for (const extra of [{ habitId, goalId }, { intention: '   ' }, { intention: 'a'.repeat(FOCUS.intentionMaxChars + 1) }]) {
      expect((await put(me, running(uuid(), extra))).status).toBe(400);
    }
    expect(await database.db.focusSession.count({ where: { userId: me.id } })).toBe(0);
  });

  it('alvo de outra pessoa ou inexistente: 404 e nada é gravado', async () => {
    const me = await h.newUser();
    const other = await h.newUser();
    for (const [key, id] of Object.entries(await targets(other.id))) {
      for (const target of [id, uuid()]) {
        const response = await put(me, running(uuid(), { [key]: target }));
        expect(response.status).toBe(404);
        expect((await response.json()).error).toBe('referencia_inexistente');
      }
    }
    expect(await database.db.focusSession.count({ where: { userId: me.id } })).toBe(0);

    // Numa sessão aberta, trocar pelo alvo de outra pessoa também é 404.
    const sid = uuid();
    await put(me, running(sid));
    const theirs = await targets((await h.newUser()).id);
    expect((await put(me, running(sid, { goalId: theirs.goalId }))).status).toBe(404);
  });

  it('em andamento: omitir mantém, um alvo novo troca, null limpa; encerrar sem os campos não apaga', async () => {
    const me = await h.newUser();
    const { habitId, goalId } = await targets(me.id);
    const sid = uuid();
    await put(me, running(sid, { intention: 'ler', habitId }));
    expect(await sessionOf(await put(me, running(sid, { pausedMs: MIN })))).toMatchObject({ intention: 'ler', habitId });
    const swapped = await sessionOf(await put(me, running(sid, { goalId })));
    expect(swapped).toEqual(running(sid, { intention: 'ler', goalId }));
    expect(await sessionOf(await put(me, running(sid, { goalId: null, intention: null })))).toEqual(running(sid));
    await put(me, running(sid, { intention: 'ler', habitId }));
    // Cliente antigo encerrando e repetindo, sem conhecer os campos.
    for (let i = 0; i < 2; i += 1) {
      const end = await put(me, finished(sid));
      expect(end.status).toBe(200);
      expect(await sessionOf(end)).toEqual(finished(sid, { intention: 'ler', habitId }));
    }
    // Encerrada não muda.
    expect((await put(me, finished(sid, { goalId }))).status).toBe(409);
    expect((await put(me, finished(sid, { intention: null }))).status).toBe(409);
  });

  it('apagar o alvo deixa a sessão sem vínculo, e o aparelho desatualizado ainda encerra', async () => {
    const me = await h.newUser();
    const { habitId, goalId, taskId } = await targets(me.id);
    const [a, b, c] = [uuid(), uuid(), uuid()];
    await put(me, finished(a, { goalId }));
    await put(me, finished(b, { taskId }));
    await put(me, running(c, { habitId }));
    for (const path of [`/api/habits/${habitId}`, `/api/goals/${goalId}`, `/api/tasks/${taskId}`]) {
      expect((await me.call('DELETE', path)).status).toBe(200);
    }
    const { sessions } = await (await me.call('GET', '/api/sessions')).json();
    expect(sessions).toHaveLength(3);
    for (const session of sessions) {
      expect(session.goalId ?? session.taskId ?? session.habitId).toBeUndefined();
    }
    // Retry do corpo antigo de uma encerrada e encerramento da aberta com o vínculo que sumiu.
    expect((await put(me, finished(a, { goalId }))).status).toBe(200);
    const end = await put(me, finished(c, { habitId }));
    expect(end.status).toBe(200);
    expect(await sessionOf(end)).toEqual(finished(c));
  });

  it('pomodoros: sessões concluídas da tarefa, de todo o histórico, nas tarefas e no sync', async () => {
    const me = await h.newUser();
    const { taskId } = await targets(me.id);
    const old = TEST_NOW - 500 * 24 * 60 * MIN;
    await put(me, finished(uuid(), { taskId, startedAt: old - 25 * MIN, endedAt: old }));
    await put(me, finished(uuid(), { taskId }));
    await put(me, finished(uuid(), { taskId, state: 'interrompida' }));
    const tasks = await (await me.call('GET', '/api/tasks')).json();
    expect(tasks.pomodoros).toEqual({ [taskId]: 2 });
    const sync = await (await me.call('GET', '/api/sync?from=2026-11-01&to=2026-11-30')).json();
    expect(sync.pomodoros).toEqual({ [taskId]: 2 });
    const other = await h.newUser();
    expect((await (await other.call('GET', '/api/tasks')).json()).pomodoros).toEqual({});
  });

  it('queries: número fixo para gravar com vínculo e para listar os pomodoros, com 1 ou 50 sessões', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    const counts: number[][] = [];
    for (const [user, scale] of [
      [small, 1],
      [big, 50],
    ] as const) {
      const { taskId } = await targets(user.id);
      await database.db.focusSession.createMany({
        data: Array.from({ length: scale }, (_, i) => ({
          userId: user.id,
          taskId,
          startedAt: new Date(TEST_NOW - (i + 2) * 60 * MIN),
          endedAt: new Date(TEST_NOW - (i + 2) * 60 * MIN + 25 * MIN),
          plannedMinutes: 25,
          state: 'concluida' as const,
        })),
      });
      const sid = uuid();
      counts.push([
        await queriesOf(database, user, 'PUT', `/api/sessions/${sid}`, running(sid, { taskId })),
        await queriesOf(database, user, 'GET', '/api/tasks'),
      ]);
    }
    expect(counts[1]).toEqual(counts[0]);
    // 2 de sessão + leitura das sessões, dono do alvo e upsert; e 2 + tarefas, subtarefas e contagem.
    expect(counts[0]).toEqual([5, 5]);
  });
});
