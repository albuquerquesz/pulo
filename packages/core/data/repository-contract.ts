// Suíte de contrato do `Repository`, reutilizável por qualquer implementação (memória, armazenamento,
// cliente remoto). Usa `describe`, `it` e `expect` globais: roda no Jest do core e no Vitest (`globals: true`).
import { JOIAS } from '../config/decisions';
import { dateKeyOf, addDays } from '../domain/day';
import { verSequencia } from '../domain/streak';
import { endedSession, sp } from '../domain/test-utils';
import type { Repository, Task, User } from '../domain/types';

/** O que cada teste recebe: um repositório vazio e o id que o `User` desse repositório precisa ter. */
export interface RepositoryUnderTest {
  repository: Repository;
  /** Id do usuário dono do repositório (no remoto é o id da conta). */
  userId: string;
}

export interface ContractOptions {
  /**
   * O repositório não grava o estado do sapo de verdade: quem calcula é o servidor
   * (`saveMascotState` só atualiza o cache). Pula a checagem de ida e volta.
   */
  mascotIsServerDerived?: boolean;
  /** "Agora" para as regras que dependem do dia. No remoto, o mesmo instante do relógio do servidor. */
  now?: number;
}

const baseUser: User = {
  id: 'u1',
  frogName: 'Pulo',
  timezone: 'America/Sao_Paulo',
  dayStartMinutes: 420,
  dayEndMinutes: 1320,
  theme: 'sistema',
  reduceMotion: false,
  createdAt: 1,
};

// Ids únicos por execução: o servidor nunca deixa duas pessoas usarem o mesmo id.
const runTag = Math.random().toString(36).slice(2, 8);
let seq = 0;
const uid = (prefix: string) => `${prefix}-${runTag}-${(seq += 1)}`;

const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  title: 'Estudar',
  status: 'afazer',
  position: 1,
  priority: 'normal',
  tags: [],
  pomodorosEstimated: 2,
  createdAt: 1,
  ...extra,
});

export function defineRepositoryContract(
  name: string,
  make: () => RepositoryUnderTest | Promise<RepositoryUnderTest>,
  options: ContractOptions = {},
): void {
  const subject = async () => {
    const { repository, userId } = await make();
    return { r: repository, user: { ...baseUser, id: userId } };
  };

  describe(`contrato do Repository: ${name}`, () => {
    it('começa vazio', async () => {
      const { r } = await subject();
      expect(await r.getUser()).toBeNull();
      expect(await r.listBlocks()).toEqual([]);
      expect(await r.listSessions()).toEqual([]);
      expect(await r.listTasks()).toEqual([]);
      expect(await r.listSubtasks()).toEqual([]);
      expect(await r.getMascotState()).toBeNull();
    });

    it('usuário e blocos: salvar, atualizar por id e apagar', async () => {
      const { r, user } = await subject();
      await r.saveUser(user);
      expect(await r.getUser()).toEqual(user);
      const b = { id: uid('b'), weekday: 0 as const, startMinutes: 540, durationMinutes: 25, kind: 'foco' as const };
      await r.saveBlock(b);
      await r.saveBlock({ ...b, durationMinutes: 30 });
      expect(await r.listBlocks()).toEqual([{ ...b, durationMinutes: 30 }]);
      await r.deleteBlock(b.id);
      expect(await r.listBlocks()).toEqual([]);
    });

    it('não vaza referências: mudar o retornado não muda o guardado', async () => {
      const { r, user } = await subject();
      await r.saveUser(user);
      const got = (await r.getUser())!;
      got.frogName = 'Outro';
      expect((await r.getUser())!.frogName).toBe('Pulo');
      const block = { id: uid('b'), weekday: 2 as const, startMinutes: 60, durationMinutes: 10, kind: 'foco' as const };
      await r.saveBlock(block);
      (await r.listBlocks())[0].durationMinutes = 99;
      expect((await r.listBlocks())[0].durationMinutes).toBe(10);
    });

    it('registros de hábito: um por hábito e dia, filtro por intervalo, apagar', async () => {
      const { r } = await subject();
      const h = uid('h');
      await r.saveHabit({ id: h, title: 'x', weekdays: [0], state: 'ativo' as const });
      await r.saveHabitLog({ habitId: h, date: '2026-11-10', doneAt: 1 });
      await r.saveHabitLog({ habitId: h, date: '2026-11-10', doneAt: 2 });
      await r.saveHabitLog({ habitId: h, date: '2026-11-12', doneAt: 3 });
      expect(await r.listHabitLogs()).toHaveLength(2);
      expect(await r.listHabitLogs({ from: '2026-11-11', to: '2026-11-30' })).toHaveLength(1);
      await r.deleteHabitLog(h, '2026-11-10');
      expect(await r.listHabitLogs()).toHaveLength(1);
    });

    it('apagar hábito apaga os registros dele', async () => {
      const { r } = await subject();
      const h = uid('h');
      await r.saveHabit({ id: h, title: 'x', weekdays: [0], state: 'ativo' as const });
      await r.saveHabitLog({ habitId: h, date: '2026-11-10', doneAt: 1 });
      await r.deleteHabit(h);
      expect(await r.listHabits()).toEqual([]);
      expect(await r.listHabitLogs()).toEqual([]);
    });

    it('sessões: em andamento pode mudar, encerrada é imutável', async () => {
      const { r } = await subject();
      const running = { id: uid('s'), startedAt: 1, plannedMinutes: 25, state: 'em_andamento' as const, pausedMs: 0 };
      await r.saveSession(running);
      await r.saveSession({ ...running, pausedSince: 5 });
      const ended = { ...running, state: 'concluida' as const, endedAt: 99 };
      await r.saveSession(ended);
      await expect(r.saveSession({ ...ended, state: 'interrompida' })).rejects.toThrow();
      expect(await r.listSessions()).toEqual([ended]);
      // a fila de escrita continua funcionando depois do erro
      await r.saveSession({ ...endedSession(sp(2026, 11, 10), 25, 'concluida'), id: uid('s') });
      expect(await r.listSessions()).toHaveLength(2);
    });

    it('sessões: intenção e vínculo ficam, e apagar o alvo solta o foco sem apagar', async () => {
      const { r } = await subject();
      const habitId = uid('h');
      await r.saveHabit({ id: habitId, title: 'Ler', weekdays: [0], state: 'ativo' });
      const session = { ...endedSession(sp(2026, 11, 9), 25, 'concluida'), id: uid('s'), intention: 'Capítulo 2', habitId };
      await r.saveSession(session);
      expect(await r.listSessions()).toEqual([session]);
      await r.deleteHabit(habitId);
      const { habitId: _gone, ...unlinked } = session;
      expect(await r.listSessions()).toEqual([unlinked]);
    });

    it('descanso, propostas e estado do mascote', async () => {
      const { r } = await subject();
      await r.saveRestDay({ date: '2026-11-10' });
      await r.saveRestDay({ date: '2026-11-10' });
      expect(await r.listRestDays()).toHaveLength(1);
      await r.deleteRestDay('2026-11-10');
      expect(await r.listRestDays()).toEqual([]);
      const p = {
        id: uid('p'), weekStart: '2026-11-09', state: 'pendente' as const, patternText: 'x', changes: [],
        origin: 'regra' as const, createdAt: 1,
      };
      await r.saveProposal(p);
      await r.saveProposal({ ...p, state: 'aceita', decidedAt: 2 });
      expect((await r.listProposals())[0].state).toBe('aceita');
      await r.saveHousePurchase({ item: 'cerca', cost: 40, createdAt: 1 });
      await r.saveRoomDecor({ item: 'tapete', cost: 10, createdAt: 1, x: 0, y: 0, rotation: 0 });
      const taskId = uid('t');
      await r.saveTask(task(taskId));
      await r.saveSubtask({ id: uid('s'), taskId, title: 'x', done: false, position: 1 });
      if (!options.mascotIsServerDerived) {
        await r.saveMascotState({ phase: 2, careDays: 4, updatedAt: 9 });
        expect(await r.getMascotState()).toEqual({ phase: 2, careDays: 4, updatedAt: 9 });
      }
    });

    it('sequência: hábito e descanso contam, desfazer recalcula', async () => {
      const { r, user } = await subject();
      await r.saveUser(user);
      const now = options.now ?? sp(2026, 11, 18);
      const today = dateKeyOf(now, user.timezone);
      const clock = { now: () => now };
      expect(await verSequencia(r, clock)).toMatchObject({ atual: 0, recorde: 0 });
      const h = uid('h');
      await r.saveHabit({ id: h, title: 'x', weekdays: [0], state: 'ativo' as const });
      await r.saveHabitLog({ habitId: h, date: addDays(today, -2), doneAt: 1 });
      await r.saveRestDay({ date: addDays(today, -1) });
      await r.saveHabitLog({ habitId: h, date: today, doneAt: 2 });
      const streak = await verSequencia(r, clock);
      expect(streak).toMatchObject({ atual: 2, recorde: 2 });
      expect(streak.semana).toHaveLength(7);
      expect(streak.semana).toContainEqual({ date: today, estado: 'feito' });
      await r.deleteHabitLog(h, today);
      expect(await verSequencia(r, clock)).toMatchObject({ atual: 1, recorde: 1 });
      await r.clearAll();
      expect(await verSequencia(r, clock)).toMatchObject({ atual: 0, recorde: 0 });
    });

    it('metas: salvar com marcos, atualizar por id e apagar', async () => {
      const { r } = await subject();
      const goal = {
        id: uid('g'), title: 'Maratona', why: 'saúde', targetDate: '2027-06-01', state: 'ativa' as const,
        milestones: [{ id: uid('m'), title: '5 km', doneAt: 3 }, { id: uid('m'), title: '10 km' }], createdAt: 1,
      };
      await r.saveGoal(goal);
      const done = { ...goal, state: 'concluida' as const, completedAt: 9 };
      await r.saveGoal(done);
      expect(await r.listGoals()).toEqual([done]);
      (await r.listGoals())[0].milestones[0].title = 'mexido';
      expect((await r.listGoals())[0].milestones[0].title).toBe('5 km');
      await r.deleteGoal(goal.id);
      expect(await r.listGoals()).toEqual([]);
    });

    it('metas: ícone, cor, baú uma vez e hábito atrelado, que fica solto ao apagar a meta', async () => {
      const { r } = await subject();
      const goalId = uid('g');
      const habitId = uid('h');
      const goal = { id: goalId, title: 'm', icon: '🏃', color: 'foco' as const, state: 'concluida' as const, milestones: [], createdAt: 1, completedAt: 2 };
      await r.saveGoal(goal);
      expect(await r.listGoals()).toEqual([goal]);
      const habit = { id: habitId, title: 'x', weekdays: [0 as const], state: 'ativo' as const };
      await r.saveHabit({ ...habit, goalId });
      expect(await r.listHabits()).toEqual([{ ...habit, goalId }]);
      await r.saveHabit(habit);
      expect(await r.listHabits()).toEqual([habit]);
      await r.saveHabit({ ...habit, goalId });
      await r.saveGoalChest({ goalId, abertoEm: 3, joias: JOIAS.por.goalCompleted });
      expect(await r.listGoalChests()).toMatchObject([{ goalId, joias: JOIAS.por.goalCompleted }]);
      await r.deleteGoal(goalId);
      expect(await r.listGoalChests()).toEqual([]);
      expect(await r.listHabits()).toEqual([habit]);
    });

    it('tarefas: criar numera em sequência, mover grava um evento só e apagar leva tudo junto', async () => {
      const { r } = await subject();
      const first = uid('t');
      const second = uid('t');
      await r.saveTask(task(first));
      await r.saveTask(task(second, { position: 2, tags: ['Faculdade'] }));
      const created = await r.listTasks();
      expect(created.map((t) => t.number).sort()).toEqual([1, 2]);

      const moved = task(first, { status: 'fazendo', createdAt: 99 });
      await r.saveTask(moved);
      await r.saveTask(moved);
      const saved = (await r.listTasks()).find((t) => t.id === first);
      expect(saved).toEqual({ ...moved, number: 1, createdAt: 1 });
      const activity = await r.listTaskActivity(first);
      expect(activity.events.map((e) => [e.kind, e.de, e.para])).toEqual([
        ['criada', undefined, 'afazer'],
        ['status', 'afazer', 'fazendo'],
      ]);

      const sub = { id: uid('s'), taskId: first, title: 'passo', done: false, position: 1 };
      await r.saveSubtask(sub);
      await r.saveSubtask({ ...sub, done: true });
      expect(await r.listSubtasks()).toEqual([{ ...sub, done: true }]);
      const comment = { id: uid('c'), taskId: first, body: 'anotado', createdAt: 5 };
      await r.addTaskComment(comment);
      await r.addTaskComment(comment);
      expect((await r.listTaskActivity(first)).comments).toEqual([comment]);
      await r.deleteSubtask(first, sub.id);
      expect(await r.listSubtasks()).toEqual([]);

      await r.saveSubtask(sub);
      await r.deleteTask(first);
      expect((await r.listTasks()).map((t) => t.id)).toEqual([second]);
      expect(await r.listSubtasks()).toEqual([]);
      await expect(r.listTaskActivity(first)).rejects.toThrow();
      // O número apagado não volta.
      const third = uid('t');
      await r.saveTask(task(third));
      expect((await r.listTasks()).find((t) => t.id === third)?.number).toBe(3);
    });

    it('tarefas: subtarefa e comentário exigem a tarefa, e apagar a meta solta o vínculo', async () => {
      const { r } = await subject();
      await expect(r.saveSubtask({ id: uid('s'), taskId: uid('t'), title: 'x', done: false, position: 1 })).rejects.toThrow();
      await expect(r.addTaskComment({ id: uid('c'), taskId: uid('t'), body: 'x', createdAt: 1 })).rejects.toThrow();
      expect(await r.listSubtasks()).toEqual([]);
      const goalId = uid('g');
      await r.saveGoal({ id: goalId, title: 'm', state: 'ativa', milestones: [], createdAt: 1 });
      const id = uid('t');
      await r.saveTask(task(id, { goalId }));
      expect((await r.listTasks())[0].goalId).toBe(goalId);
      await r.deleteGoal(goalId);
      expect((await r.listTasks())[0].goalId).toBeUndefined();
    });

    it('ilha: compras por item, sem duplicar', async () => {
      const { r } = await subject();
      await r.saveIslandPurchase({ item: 'banco', cost: 8, createdAt: 1 });
      await r.saveIslandPurchase({ item: 'praia', cost: 40, createdAt: 2 });
      const compras = await r.listIslandPurchases();
      expect([...compras].sort((a, b) => a.createdAt - b.createdAt)).toEqual([
        { item: 'banco', cost: 8, createdAt: 1 },
        { item: 'praia', cost: 40, createdAt: 2 },
      ]);
    });

    it('casa e quarto: compras por item, mover muda só a posição', async () => {
      const { r } = await subject();
      const parte = { item: 'cerca', cost: 40, createdAt: 1 };
      const tapete = { item: 'tapete', cost: 10, createdAt: 2, x: 0, y: 0, rotation: 0 as const };
      await r.saveHousePurchase(parte);
      await r.saveRoomDecor(tapete);
      await r.moveRoomDecor('tapete', { x: 1, y: 2, rotation: 180 });
      expect(await r.listHousePurchases()).toEqual([parte]);
      expect(await r.listRoomDecor()).toEqual([{ ...tapete, x: 1, y: 2, rotation: 180 }]);
      expect(await r.getJoiaCredit()).toBe(0);
    });

    it('escritas concorrentes não se perdem', async () => {
      const { r } = await subject();
      const h = uid('h');
      await r.saveHabit({ id: h, title: 'x', weekdays: [0], state: 'ativo' as const });
      await Promise.all(
        Array.from({ length: 20 }, (_, i) => r.saveHabitLog({ habitId: h, date: `2026-11-${String(i + 1).padStart(2, '0')}`, doneAt: i })),
      );
      expect(await r.listHabitLogs()).toHaveLength(20);
    });

    it('clearAll zera tudo, inclusive sessões e mascote', async () => {
      const { r, user } = await subject();
      const h = uid('h');
      await r.saveUser(user);
      await r.saveBlock({ id: uid('b'), weekday: 1, startMinutes: 0, durationMinutes: 5, kind: 'descanso' });
      await r.saveHabit({ id: h, title: 'x', weekdays: [0], state: 'ativo' as const });
      await r.saveHabitLog({ habitId: h, date: '2026-11-10', doneAt: 1 });
      await r.saveSession({ ...endedSession(1, 25, 'concluida'), id: uid('s') });
      await r.saveRestDay({ date: '2026-11-10' });
      await r.saveProposal({ id: uid('p'), weekStart: '2026-11-09', state: 'pendente', patternText: 'x', changes: [], origin: 'ia', createdAt: 1 });
      await r.saveGoal({ id: uid('g'), title: 'x', state: 'ativa', milestones: [], createdAt: 1 });
      await r.saveIslandPurchase({ item: 'banco', cost: 8, createdAt: 1 });
      if (!options.mascotIsServerDerived) await r.saveMascotState({ phase: 3, careDays: 9, updatedAt: 1 });
      await r.clearAll();
      expect(await r.getUser()).toBeNull();
      expect(await r.listBlocks()).toEqual([]);
      expect(await r.listHabits()).toEqual([]);
      expect(await r.listHabitLogs()).toEqual([]);
      expect(await r.listSessions()).toEqual([]);
      expect(await r.listTasks()).toEqual([]);
      expect(await r.listSubtasks()).toEqual([]);
      expect(await r.listRestDays()).toEqual([]);
      expect(await r.listProposals()).toEqual([]);
      expect(await r.listGoals()).toEqual([]);
      expect(await r.listIslandPurchases()).toEqual([]);
      expect(await r.listHousePurchases()).toEqual([]);
      expect(await r.listRoomDecor()).toEqual([]);
      expect(await r.getMascotState()).toBeNull();
    });
  });
}
