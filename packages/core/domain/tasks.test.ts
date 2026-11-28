import { TASKS } from '../config/decisions';
import { taskSchema } from '../api/schemas';
import { createMemoryRepository } from '../data/memory-repository';
import { fixedClock } from './clock';
import {
  columnTasks,
  criarTarefa,
  endOfWeekDue,
  matchesDueFilter,
  moverTarefa,
  pomodorosDone,
  positionBetween,
  subtaskProgress,
  taskChanges,
  taskTimeline,
  todayTasks,
} from './tasks';
import type { Task } from './types';

const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id, title: id, status: 'afazer', position: 1, priority: 'normal', tags: [], pomodorosEstimated: 0, createdAt: 1, ...extra,
});

describe('schema da tarefa', () => {
  it('aceita a tarefa e recusa estados incoerentes e limites estourados', () => {
    expect(taskSchema.parse(task('t1'))).toEqual(task('t1'));
    const invalid: Partial<Task>[] = [
      { title: ' ' },
      { title: 'a'.repeat(TASKS.titleMaxChars + 1) },
      { description: 'a'.repeat(TASKS.descriptionMaxChars + 1) },
      { tags: Array.from({ length: TASKS.maxTags + 1 }, (_, i) => `t${i}`) },
      { tags: ['a', 'a'] },
      { status: 'feito' },
      { completedAt: 2 },
      { pomodorosEstimated: -1 },
      { position: Number.POSITIVE_INFINITY },
    ];
    for (const extra of invalid) expect(taskSchema.safeParse(task('t1', extra)).success, JSON.stringify(extra)).toBe(false);
  });
});

describe('regras do quadro', () => {
  it('posições, filtros, hoje e progresso', () => {
    expect(positionBetween(undefined, undefined)).toBe(TASKS.positionStep);
    expect(positionBetween(1, 2)).toBe(1.5);
    expect(columnTasks([task('b', { position: 2 }), task('a'), task('c', { status: 'feito' })], 'afazer').map((t) => t.id)).toEqual(['a', 'b']);

    // 2026-11-24 é terça; a semana termina no domingo 29.
    const today = '2026-11-24';
    expect(endOfWeekDue(today)).toBe('2026-11-29');
    expect(matchesDueFilter({ status: 'afazer', dueDate: '2026-11-23' }, 'hoje', today)).toBe(true);
    expect(matchesDueFilter({ status: 'afazer', dueDate: '2026-11-29' }, 'hoje', today)).toBe(false);
    expect(matchesDueFilter({ status: 'afazer', dueDate: '2026-11-29' }, 'semana', today)).toBe(true);
    expect(matchesDueFilter({ status: 'afazer', dueDate: '2026-11-30' }, 'semana', today)).toBe(false);
    expect(matchesDueFilter({ status: 'afazer' }, 'semana', today)).toBe(false);
    // A feita com prazo passado sai do filtro; a aberta fica.
    expect(matchesDueFilter({ status: 'feito', dueDate: '2026-11-23' }, 'semana', today)).toBe(false);
    expect(matchesDueFilter({ status: 'feito', dueDate: today }, 'hoje', today)).toBe(true);
    const list = [
      task('hoje', { dueDate: today, status: 'feito', completedAt: 2 }),
      task('vencida', { dueDate: '2026-11-20' }),
      task('antiga-feita', { dueDate: '2026-11-20', status: 'feito', completedAt: 2 }),
      task('depois', { dueDate: '2026-11-25' }),
    ];
    expect(todayTasks(list, today).map((t) => t.id)).toEqual(['vencida', 'hoje']);

    const subtasks = [
      { id: 's1', taskId: 't', title: 'a', done: true, position: 1 },
      { id: 's2', taskId: 't', title: 'b', done: false, position: 2 },
      { id: 's3', taskId: 'outra', title: 'c', done: true, position: 1 },
    ];
    expect(subtaskProgress(subtasks, 't')).toEqual({ done: 1, total: 2 });
  });

  it('pomodoros feitos: só sessões concluídas desta tarefa', () => {
    const sessions = [
      { state: 'concluida' as const, taskId: 't' },
      { state: 'concluida' as const, taskId: 't' },
      { state: 'interrompida' as const, taskId: 't' },
      { state: 'em_andamento' as const, taskId: 't' },
      { state: 'concluida' as const, taskId: 'outra' },
      { state: 'concluida' as const },
    ];
    expect(pomodorosDone(sessions, 't')).toBe(2);
    expect(pomodorosDone([], 't')).toBe(0);
  });

  it('histórico: o que mudou e a linha do tempo com comentários', () => {
    const before = task('t', { dueDate: '2026-11-24' });
    expect(taskChanges(undefined, before)).toEqual([{ kind: 'criada', para: 'afazer' }]);
    expect(taskChanges(before, { ...before, title: 'outro', position: 9 })).toEqual([]);
    expect(taskChanges(before, task('t', { status: 'fazendo', priority: 'alta' }))).toEqual([
      { kind: 'status', de: 'afazer', para: 'fazendo' },
      { kind: 'prioridade', de: 'normal', para: 'alta' },
      { kind: 'prazo', de: '2026-11-24' },
    ]);
    const timeline = taskTimeline({
      events: [{ id: 'e1', taskId: 't', kind: 'criada', createdAt: 1 }, { id: 'e2', taskId: 't', kind: 'status', createdAt: 5 }],
      comments: [{ id: 'c1', taskId: 't', body: 'x', createdAt: 3 }],
    });
    expect(timeline.map((item) => (item.type === 'evento' ? item.event.id : item.comment.id))).toEqual(['e1', 'c1', 'e2']);
  });
});

describe('casos de uso', () => {
  it('cria no fim ou no topo, move e marca quando concluiu', async () => {
    const clock = fixedClock(1000);
    const repo = createMemoryRepository(undefined, clock);
    const a = await criarTarefa(repo, { title: ' A ', tags: ['x', 'x', ' '] }, 1000);
    const b = await criarTarefa(repo, { title: 'B' }, 1001, 'topo');
    if (!a.ok || !b.ok) throw new Error('criação falhou');
    expect(a.value).toMatchObject({ title: 'A', tags: ['x'], status: 'afazer' });
    expect(columnTasks(await repo.listTasks(), 'afazer').map((t) => t.title)).toEqual(['B', 'A']);

    const done = await moverTarefa(repo, a.value.id, 'feito', 2000);
    expect(done.ok && done.value.completedAt).toBe(2000);
    const back = await moverTarefa(repo, a.value.id, 'fazendo', 3000);
    expect(back.ok && back.value.completedAt).toBeUndefined();

    expect((await criarTarefa(repo, { title: '  ' }, 1)).ok).toBe(false);
    expect((await criarTarefa(repo, { title: 'x', goalId: 'nada' }, 1)).ok).toBe(false);
    expect((await moverTarefa(repo, 'nada', 'feito', 1)).ok).toBe(false);
  });
});
