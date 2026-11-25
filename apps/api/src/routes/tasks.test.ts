import { TASKS } from '@pulo/core/config/decisions';
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

const uuid = () => crypto.randomUUID();
const task = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: 'Entregar o trabalho',
  description: 'com links',
  status: 'afazer',
  position: 1.5,
  priority: 'normal',
  dueDate: '2026-11-24',
  tags: ['Faculdade'],
  pomodorosEstimated: 3,
  createdAt: 10,
  ...extra,
});
const subtask = (id: string, taskId: string, extra: Record<string, unknown> = {}) => ({ id, taskId, title: 'passo', done: false, position: 1, ...extra });
const comment = (id: string, taskId: string, extra: Record<string, unknown> = {}) => ({ id, taskId, body: 'anotado', createdAt: TEST_NOW - 1, ...extra });

const sync = async (user: TestUser) => (await user.call('GET', '/api/sync?from=2026-11-01&to=2026-11-30')).json();
const activity = async (user: TestUser, id: string) => (await user.call('GET', `/api/tasks/${id}/activity`)).json();

async function create(user: TestUser, extra: Record<string, unknown> = {}) {
  const id = uuid();
  const res = await user.call('PUT', `/api/tasks/${id}`, task(id, extra));
  expect(res.status).toBe(200);
  return { id, saved: (await res.json()).task };
}

describe('/api/tasks', () => {
  it('exige sessão', async () => {
    const id = uuid();
    const calls = [
      ['GET', '/api/tasks'],
      ['PUT', `/api/tasks/${id}`],
      ['DELETE', `/api/tasks/${id}`],
      ['PUT', `/api/tasks/${id}/subtasks/${id}`],
      ['DELETE', `/api/tasks/${id}/subtasks/${id}`],
      ['POST', `/api/tasks/${id}/comments`],
      ['GET', `/api/tasks/${id}/activity`],
    ] as const;
    for (const [method, path] of calls) expect((await h.app.request(path, { method })).status, path).toBe(401);
  });

  it('o que entra sai igual no sync; repetir não duplica', async () => {
    const me = await h.newUser();
    const { id, saved } = await create(me);
    expect(saved).toEqual(task(id));
    // Campo desconhecido (como o `number` de um cliente antigo) é ignorado e o createdAt da primeira gravação fica.
    const again = await me.call('PUT', `/api/tasks/${id}`, task(id, { number: 99, createdAt: 77 }));
    expect((await again.json()).task).toEqual(saved);
    const sub = subtask(uuid(), id);
    expect(await (await me.call('PUT', `/api/tasks/${id}/subtasks/${sub.id}`, sub)).json()).toEqual({ subtask: sub });
    await me.call('PUT', `/api/tasks/${id}/subtasks/${sub.id}`, { ...sub, done: true });

    const body = await sync(me);
    expect(body.tasks).toEqual([saved]);
    expect(body.subtasks).toEqual([{ ...sub, done: true }]);
    expect(await (await me.call('GET', '/api/tasks')).json()).toEqual({ tasks: [saved], subtasks: [{ ...sub, done: true }], pomodoros: {} });
    expect((await activity(me, id)).events).toHaveLength(1);

    const semOpcionais = task(id, { description: undefined, dueDate: undefined, tags: [] });
    const cleared = (await (await me.call('PUT', `/api/tasks/${id}`, semOpcionais)).json()).task;
    expect(cleared).not.toHaveProperty('description');
    expect(cleared).not.toHaveProperty('dueDate');
  });

  it('mover grava um evento só, mesmo repetindo ao mesmo tempo; o histórico junta os comentários', async () => {
    const me = await h.newUser();
    const { id } = await create(me);
    const moved = task(id, { status: 'fazendo' });
    const responses = await Promise.all([1, 2, 3].map(() => me.call('PUT', `/api/tasks/${id}`, moved)));
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    // Reordenar e editar o título não entram no histórico.
    await me.call('PUT', `/api/tasks/${id}`, task(id, { status: 'fazendo', position: 9, title: 'Outro' }));
    h.setNow(TEST_NOW + 1000);
    await me.call('PUT', `/api/tasks/${id}`, task(id, { status: 'feito', completedAt: TEST_NOW, priority: 'alta', dueDate: undefined }));
    const note = comment(uuid(), id, { createdAt: TEST_NOW + 500 });
    expect(await (await me.call('POST', `/api/tasks/${id}/comments`, note)).json()).toEqual({ comment: note });
    expect((await me.call('POST', `/api/tasks/${id}/comments`, note)).status).toBe(200);
    h.setNow(TEST_NOW);

    const body = await activity(me, id);
    expect(body.comments).toEqual([note]);
    expect(body.events.map((e: Record<string, unknown>) => [e.kind, e.de, e.para, e.createdAt])).toEqual([
      ['criada', undefined, 'afazer', TEST_NOW],
      ['status', 'afazer', 'fazendo', TEST_NOW],
      ['status', 'fazendo', 'feito', TEST_NOW + 1000],
      ['prioridade', 'normal', 'alta', TEST_NOW + 1000],
      ['prazo', '2026-11-24', undefined, TEST_NOW + 1000],
    ]);

    const conflict = await me.call('POST', `/api/tasks/${id}/comments`, { ...note, body: 'outro' });
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error).toBe('conflito_de_id');
  });

  it('meta: precisa ser da pessoa, e apagar a meta solta o vínculo', async () => {
    const me = await h.newUser();
    const other = await h.newUser();
    const goalId = uuid();
    await other.call('PUT', `/api/goals/${goalId}`, { id: goalId, title: 'm', state: 'ativa', milestones: [], createdAt: 1 });
    const id = uuid();
    const foreign = await me.call('PUT', `/api/tasks/${id}`, task(id, { goalId }));
    expect(foreign.status).toBe(404);
    expect((await foreign.json()).error).toBe('referencia_inexistente');
    expect((await sync(me)).tasks).toEqual([]);

    const mine = uuid();
    await me.call('PUT', `/api/goals/${mine}`, { id: mine, title: 'm', state: 'ativa', milestones: [], createdAt: 1 });
    await me.call('PUT', `/api/tasks/${id}`, task(id, { goalId: mine }));
    expect((await sync(me)).tasks[0]).toMatchObject({ goalId: mine });
    await me.call('DELETE', `/api/goals/${mine}`);
    expect((await sync(me)).tasks[0]).not.toHaveProperty('goalId');
  });

  it('valida corpo, caminho e instantes', async () => {
    const me = await h.newUser();
    const id = uuid();
    const invalid = [
      task(id, { title: ' ' }),
      task(id, { title: 'a'.repeat(TASKS.titleMaxChars + 1) }),
      task(id, { description: 'a'.repeat(TASKS.descriptionMaxChars + 1) }),
      task(id, { tags: Array.from({ length: TASKS.maxTags + 1 }, (_, i) => `t${i}`) }),
      task(id, { status: 'pausada' }),
      task(id, { status: 'feito' }),
      task(id, { dueDate: '2026-02-31' }),
      task(id, { pomodorosEstimated: TASKS.maxPomodorosEstimated + 1 }),
    ];
    for (const bad of invalid) expect((await me.call('PUT', `/api/tasks/${id}`, bad)).status).toBe(400);
    expect((await (await me.call('PUT', `/api/tasks/${uuid()}`, task(id))).json()).error).toBe('id_divergente');
    const future = await me.call('PUT', `/api/tasks/${id}`, task(id, { createdAt: TEST_NOW + 3_600_000 }));
    expect((await future.json()).error).toBe('horario_no_futuro');
    const title = 'a'.repeat(TASKS.titleMaxChars);
    expect((await me.call('PUT', `/api/tasks/${id}`, task(id, { title }))).status).toBe(200);
    const sid = uuid();
    expect((await me.call('PUT', `/api/tasks/${id}/subtasks/${sid}`, subtask(sid, uuid()))).status).toBe(400);
    expect((await me.call('POST', `/api/tasks/${id}/comments`, comment(sid, id, { body: ' ' }))).status).toBe(400);
  });

  it(`até ${TASKS.maxSubtasks} subtarefas, e a subtarefa não muda de tarefa`, async () => {
    const me = await h.newUser();
    const { id } = await create(me);
    await database.db.taskSubtask.createMany({
      data: Array.from({ length: TASKS.maxSubtasks }, (_, i) => ({ id: `${id.slice(0, 30)}-${i}`, userId: me.id, taskId: id, title: 'x', done: false, position: i })),
    });
    const extra = subtask(uuid(), id);
    const blocked = await me.call('PUT', `/api/tasks/${id}/subtasks/${extra.id}`, extra);
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).error).toBe('limite_de_subtarefas');
    const first = subtask(`${id.slice(0, 30)}-0`, id, { done: true });
    expect((await me.call('PUT', `/api/tasks/${id}/subtasks/${first.id}`, first)).status).toBe(200);

    const { id: second } = await create(me);
    expect((await me.call('PUT', `/api/tasks/${second}/subtasks/${first.id}`, subtask(first.id, second))).status).toBe(409);
    expect(await (await me.call('DELETE', `/api/tasks/${id}/subtasks/${first.id}`)).json()).toEqual({ deleted: 1 });
    expect(await (await me.call('DELETE', `/api/tasks/${id}/subtasks/${first.id}`)).json()).toEqual({ deleted: 0 });
  });

  it('isolamento: tarefa de outra pessoa responde 404 e nada muda', async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    const { id, saved } = await create(a);
    const sub = subtask(uuid(), id);
    await a.call('PUT', `/api/tasks/${id}/subtasks/${sub.id}`, sub);
    const note = comment(uuid(), id);
    await a.call('POST', `/api/tasks/${id}/comments`, note);

    expect((await b.call('PUT', `/api/tasks/${id}`, task(id, { title: 'roubada' }))).status).toBe(404);
    expect((await b.call('PUT', `/api/tasks/${id}/subtasks/${sub.id}`, sub)).status).toBe(404);
    expect((await b.call('POST', `/api/tasks/${id}/comments`, comment(uuid(), id))).status).toBe(404);
    expect((await b.call('GET', `/api/tasks/${id}/activity`)).status).toBe(404);
    expect(await (await b.call('DELETE', `/api/tasks/${id}/subtasks/${sub.id}`)).json()).toEqual({ deleted: 0 });
    expect(await (await b.call('DELETE', `/api/tasks/${id}`)).json()).toEqual({ deleted: 0 });
    // Reusar o id de subtarefa ou de comentário de outra pessoa não sobrescreve.
    const { id: mine } = await create(b);
    expect((await b.call('PUT', `/api/tasks/${mine}/subtasks/${sub.id}`, subtask(sub.id, mine))).status).toBe(409);
    expect((await b.call('POST', `/api/tasks/${mine}/comments`, comment(note.id, mine))).status).toBe(409);
    expect((await sync(a)).tasks).toEqual([saved]);
    expect((await sync(a)).subtasks).toEqual([sub]);
    expect((await sync(b)).tasks.map((t: { id: string }) => t.id)).toEqual([mine]);
  });

  it('apagar leva subtarefas, comentários e eventos; apagar os dados leva tudo', async () => {
    const me = await h.newUser();
    const { id } = await create(me);
    await me.call('PUT', `/api/tasks/${id}/subtasks/${id}`, subtask(id, id));
    await me.call('POST', `/api/tasks/${id}/comments`, comment(uuid(), id));
    const count = () =>
      Promise.all([
        database.db.task.count({ where: { userId: me.id } }),
        database.db.taskSubtask.count({ where: { userId: me.id } }),
        database.db.taskComment.count({ where: { userId: me.id } }),
        database.db.taskEvent.count({ where: { userId: me.id } }),
      ]);
    expect(await count()).toEqual([1, 1, 1, 1]);
    expect(await (await me.call('DELETE', `/api/tasks/${id}`)).json()).toEqual({ deleted: 1 });
    expect(await count()).toEqual([0, 0, 0, 0]);

    await create(me);
    expect((await (await me.call('DELETE', '/api/data')).json()).deleted).toMatchObject({ tasks: 1 });
    expect(await count()).toEqual([0, 0, 0, 0]);
  });

  it('queries: número fixo com 1 e com 50 tarefas', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    const seed = async (user: TestUser, total: number) => {
      const { id } = await create(user);
      await database.db.task.createMany({
        data: Array.from({ length: total - 1 }, (_, i) => ({
          userId: user.id, title: 't', status: 'afazer' as const, position: i, priority: 'normal' as const, tags: [], pomodorosEstimated: 0, createdAt: new Date(i),
        })),
      });
      const rows = Array.from({ length: total - 1 }, (_, i) => i);
      await database.db.taskSubtask.createMany({ data: rows.map((i) => ({ userId: user.id, taskId: id, title: 's', done: false, position: i })) });
      await database.db.taskComment.createMany({ data: rows.map((i) => ({ userId: user.id, taskId: id, body: 'c', createdAt: new Date(i) })) });
      await database.db.taskEvent.createMany({ data: rows.map((i) => ({ userId: user.id, taskId: id, kind: 'status' as const, createdAt: new Date(i) })) });
      return id;
    };
    const one = await seed(small, 1);
    const many = await seed(big, TASKS.maxSubtasks);

    const compare = async (method: 'GET' | 'PUT' | 'POST' | 'DELETE', path: (id: string) => string, body: (id: string) => unknown, total: number) => {
      expect(await queriesOf(database, small, method, path(one), body(one)), `${method} ${path('id')}`).toBe(total);
      expect(await queriesOf(database, big, method, path(many), body(many)), `${method} ${path('id')}`).toBe(total);
    };
    await compare('GET', () => '/api/tasks', () => undefined, 5);
    await compare('GET', (id) => `/api/tasks/${id}/activity`, () => undefined, 5);
    // Mudando de coluna: trava, leitura, update e o evento.
    await compare('PUT', (id) => `/api/tasks/${id}`, (id) => task(id, { status: 'fazendo' }), 6);

    const created = [uuid(), uuid()];
    // Criando: trava, leitura, insert e o evento.
    expect(await queriesOf(database, small, 'PUT', `/api/tasks/${created[0]}`, task(created[0]))).toBe(6);
    expect(await queriesOf(database, big, 'PUT', `/api/tasks/${created[1]}`, task(created[1]))).toBe(6);

    // O limite de subtarefas deixa a tarefa grande com uma vaga.
    const subIds = new Map<string, string>([[one, uuid()], [many, uuid()]]);
    const subId = (id: string) => subIds.get(id) ?? '';
    await compare('PUT', (id) => `/api/tasks/${id}/subtasks/${subId(id)}`, (id) => subtask(subId(id), id), 6);
    await compare('DELETE', (id) => `/api/tasks/${id}/subtasks/${subId(id)}`, () => undefined, 3);
    await compare('POST', (id) => `/api/tasks/${id}/comments`, (id) => comment(uuid(), id), 6);
    await compare('DELETE', (id) => `/api/tasks/${id}`, () => undefined, 4);
  });
});
