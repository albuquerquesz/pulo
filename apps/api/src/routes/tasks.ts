import { TASKS } from '@pulo/core/config/decisions';
import { idParamSchema, subtaskParamSchema, taskCommentSchema, taskSchema, taskSubtaskSchema } from '@pulo/core/api/schemas';
import { taskChanges } from '@pulo/core/domain/tasks';
import { type Prisma, taskCommentMapper, taskEventMapper, taskMapper, taskSubtaskMapper } from '@pulo/db';
import { Hono } from 'hono';
import { ApiError, type AppEnv, type Client, type RouteDeps, assertNotInFuture, jsonBody, pathParams, requireMatch, requireSession, sameValue } from '../http';
import { taskCommentSelect, taskEventSelect, taskSelect, taskSubtaskSelect } from '../selects';

const semTarefa = () => new ApiError(404, 'nao_encontrado', 'Essa tarefa não existe.');

/**
 * Uma escrita de tarefa por pessoa de cada vez, até o fim da transação. Sem isso, dois `PUT` simultâneos
 * poderiam gravar o mesmo evento duas vezes ou passar juntos do limite de subtarefas.
 */
const travarTarefas = (client: Client, userId: string) =>
  client.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`tarefas:${userId}`}, 0))`;

async function exigirTarefa(client: Client, userId: string, id: string): Promise<void> {
  const task = await client.task.findUnique({ where: { id_userId: { id, userId } }, select: { id: true } });
  if (!task) throw semTarefa();
}

/** Tarefas em quadro: `/api/tasks`, com subtarefas, comentários e histórico. */
export function taskRoutes({ auth, db, now }: RouteDeps) {
  return new Hono<AppEnv>()
    .use(requireSession(auth))
    .get('/', async (c) => {
      const where = { userId: c.var.user.id };
      const [tasks, subtasks] = await db.$transaction([
        db.task.findMany({ where, select: taskSelect, orderBy: { number: 'asc' } }),
        db.taskSubtask.findMany({ where, select: taskSubtaskSelect, orderBy: [{ position: 'asc' }, { id: 'asc' }] }),
      ]);
      return c.json({ tasks: tasks.map(taskMapper.toDomain), subtasks: subtasks.map(taskSubtaskMapper.toDomain) });
    })
    .put('/:id', pathParams(idParamSchema), jsonBody(taskSchema), async (c) => {
      const task = c.req.valid('json');
      requireMatch(c.req.valid('param').id, task.id, 'id_divergente');
      const serverNow = now();
      assertNotInFuture(task.createdAt, serverNow, 'createdAt');
      assertNotInFuture(task.completedAt, serverNow, 'completedAt');
      const userId = c.var.user.id;

      const saved = await db.$transaction(async (tx) => {
        await travarTarefas(tx, userId);
        // Pela chave só: tarefa de outra pessoa responde 404 e nada é gravado.
        const row = await tx.task.findUnique({ where: { id: task.id }, select: { ...taskSelect, userId: true } });
        if (row && row.userId !== userId) throw semTarefa();
        const previous = row ? taskMapper.toDomain(row) : undefined;
        if (task.goalId !== undefined && task.goalId !== previous?.goalId) {
          const owned = await tx.goal.count({ where: { id: task.goalId, userId } });
          if (owned === 0) throw new ApiError(404, 'referencia_inexistente', 'A meta não existe.');
        }

        let data: Prisma.TaskUncheckedCreateInput;
        if (previous?.number === undefined) {
          const { last } = await tx.taskCounter.upsert({
            where: { userId },
            create: { userId, last: 1 },
            update: { last: { increment: 1 } },
            select: { last: true },
          });
          data = taskMapper.fromDomain(userId, task, last);
        } else {
          // O número e o instante da criação são os da primeira gravação.
          data = taskMapper.fromDomain(userId, { ...task, createdAt: previous.createdAt }, previous.number);
        }
        const { id: _id, userId: _owner, number: _number, ...update } = data;
        const stored = previous
          ? await tx.task.update({ where: { id_userId: { id: task.id, userId } }, data: update, select: taskSelect })
          : await tx.task.create({ data, select: taskSelect });

        const changes = taskChanges(previous, task);
        if (changes.length > 0) {
          await tx.taskEvent.createMany({
            data: changes.map((change) => ({ userId, taskId: task.id, ...change, createdAt: new Date(serverNow) })),
          });
        }
        return taskMapper.toDomain(stored);
      });
      return c.json({ task: saved });
    })
    .delete('/:id', pathParams(idParamSchema), async (c) => {
      const userId = c.var.user.id;
      // Subtarefas, comentários e eventos saem junto (cascade). O contador fica: o número não volta.
      const [, { count }] = await db.$transaction([
        travarTarefas(db, userId),
        db.task.deleteMany({ where: { id: c.req.valid('param').id, userId } }),
      ]);
      return c.json({ deleted: count });
    })
    .put('/:id/subtasks/:subId', pathParams(subtaskParamSchema), jsonBody(taskSubtaskSchema), async (c) => {
      const subtask = c.req.valid('json');
      const { id: taskId, subId } = c.req.valid('param');
      requireMatch(taskId, subtask.taskId, 'id_divergente');
      requireMatch(subId, subtask.id, 'id_divergente');
      const userId = c.var.user.id;

      const saved = await db.$transaction(async (tx) => {
        await travarTarefas(tx, userId);
        await exigirTarefa(tx, userId, taskId);
        const rows = await tx.taskSubtask.findMany({ where: { userId, OR: [{ taskId }, { id: subId }] }, select: { id: true, taskId: true } });
        const existing = rows.find((row) => row.id === subId);
        if (existing && existing.taskId !== taskId) throw new ApiError(409, 'conflito_de_id', 'Esse identificador é de outra subtarefa.');
        if (!existing && rows.length >= TASKS.maxSubtasks) {
          throw new ApiError(409, 'limite_de_subtarefas', `Até ${TASKS.maxSubtasks} subtarefas por tarefa.`);
        }
        const data = taskSubtaskMapper.fromDomain(userId, subtask);
        const { title, done, position } = subtask;
        return tx.taskSubtask.upsert({
          where: { id_userId: { id: subId, userId } },
          create: data,
          update: { title, done, position },
          select: taskSubtaskSelect,
        });
      });
      return c.json({ subtask: taskSubtaskMapper.toDomain(saved) });
    })
    .delete('/:id/subtasks/:subId', pathParams(subtaskParamSchema), async (c) => {
      const { id: taskId, subId } = c.req.valid('param');
      const { count } = await db.taskSubtask.deleteMany({ where: { id: subId, taskId, userId: c.var.user.id } });
      return c.json({ deleted: count });
    })
    .post('/:id/comments', pathParams(idParamSchema), jsonBody(taskCommentSchema), async (c) => {
      const comment = c.req.valid('json');
      const taskId = c.req.valid('param').id;
      requireMatch(taskId, comment.taskId, 'id_divergente');
      assertNotInFuture(comment.createdAt, now(), 'createdAt');
      const userId = c.var.user.id;

      const saved = await db.$transaction(async (tx) => {
        await travarTarefas(tx, userId);
        await exigirTarefa(tx, userId, taskId);
        // Comentário não muda: repetir o mesmo é um retry seguro. O id de outra pessoa cai no índice único (409).
        const existing = await tx.taskComment.findFirst({ where: { id: comment.id, userId }, select: taskCommentSelect });
        if (existing) {
          const current = taskCommentMapper.toDomain(existing);
          if (!sameValue(current, comment)) throw new ApiError(409, 'conflito_de_id', 'Já existe um comentário com este identificador.');
          return current;
        }
        const row = await tx.taskComment.create({ data: taskCommentMapper.fromDomain(userId, comment), select: taskCommentSelect });
        return taskCommentMapper.toDomain(row);
      });
      return c.json({ comment: saved });
    })
    .get('/:id/activity', pathParams(idParamSchema), async (c) => {
      const userId = c.var.user.id;
      const taskId = c.req.valid('param').id;
      const where = { userId, taskId };
      const [task, events, comments] = await db.$transaction([
        db.task.findUnique({ where: { id_userId: { id: taskId, userId } }, select: { id: true } }),
        db.taskEvent.findMany({ where, select: taskEventSelect, orderBy: [{ createdAt: 'asc' }, { seq: 'asc' }] }),
        db.taskComment.findMany({ where, select: taskCommentSelect, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
      ]);
      if (!task) throw semTarefa();
      return c.json({ events: events.map(taskEventMapper.toDomain), comments: comments.map(taskCommentMapper.toDomain) });
    });
}
