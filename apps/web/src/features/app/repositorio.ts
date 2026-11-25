import { isRemoteError, mensagemDeErro, RemoteError } from '@pulo/client';
import { type BatchRepository, supportsBatch } from '@pulo/core/data/batch';
import { providesPomodoros, type PomodoroSource } from '@pulo/core/domain/tasks';
import type { Repository } from '@pulo/core/domain/types';

/** Repositório "fechado": enquanto não há dados (login ou carregando), qualquer uso falha em vez de gravar no lugar errado. */
export const repositorioFechado: Repository = (() => {
  const falha = (): Promise<never> =>
    Promise.reject(new RemoteError({ kind: 'sessao', mensagem: 'Entre na sua conta para continuar.' }));
  return {
    getUser: falha,
    saveUser: falha,
    listBlocks: falha,
    saveBlock: falha,
    deleteBlock: falha,
    listHabits: falha,
    saveHabit: falha,
    deleteHabit: falha,
    listHabitLogs: falha,
    saveHabitLog: falha,
    deleteHabitLog: falha,
    listSessions: falha,
    saveSession: falha,
    listRestDays: falha,
    saveRestDay: falha,
    deleteRestDay: falha,
    listProposals: falha,
    saveProposal: falha,
    listGoals: falha,
    saveGoal: falha,
    deleteGoal: falha,
    listGoalChests: falha,
    saveGoalChest: falha,
    listIslandPurchases: falha,
    saveIslandPurchase: falha,
    listHousePurchases: falha,
    saveHousePurchase: falha,
    listRoomDecor: falha,
    saveRoomDecor: falha,
    moveRoomDecor: falha,
    getJoiaCredit: falha,
    listTasks: falha,
    saveTask: falha,
    deleteTask: falha,
    listSubtasks: falha,
    saveSubtask: falha,
    deleteSubtask: falha,
    addTaskComment: falha,
    listTaskActivity: falha,
    getMascotState: falha,
    saveMascotState: falha,
    clearAll: falha,
  };
})();

export interface AvisosDeErro {
  /** Mostra o texto ao usuário (toast). */
  avisar(mensagem: string): void;
  /** A sessão acabou no meio do uso: volte para o login. */
  sessaoExpirou(): void;
}

/**
 * Envolve um repositório: quando uma ESCRITA falha (rede, servidor, regra), avisa em português e repassa o erro,
 * para o fluxo da tela parar no ponto certo. As leituras vêm do cache e não são tocadas.
 */
export function comAvisosDeErro(repo: Repository, avisos: AvisosDeErro): Repository {
  const guardar =
    <A extends unknown[]>(escrita: (...args: A) => Promise<void>) =>
    async (...args: A): Promise<void> => {
      try {
        await escrita(...args);
      } catch (erro) {
        if (isRemoteError(erro) && erro.kind === 'sessao') avisos.sessaoExpirou();
        else avisos.avisar(mensagemDeErro(erro));
        throw erro;
      }
    };
  const base: Repository = {
    getUser: () => repo.getUser(),
    saveUser: guardar((u) => repo.saveUser(u)),
    listBlocks: () => repo.listBlocks(),
    saveBlock: guardar((b) => repo.saveBlock(b)),
    deleteBlock: guardar((id) => repo.deleteBlock(id)),
    listHabits: () => repo.listHabits(),
    saveHabit: guardar((h) => repo.saveHabit(h)),
    deleteHabit: guardar((id) => repo.deleteHabit(id)),
    listHabitLogs: (range) => repo.listHabitLogs(range),
    saveHabitLog: guardar((l) => repo.saveHabitLog(l)),
    deleteHabitLog: guardar((id, date) => repo.deleteHabitLog(id, date)),
    listSessions: () => repo.listSessions(),
    saveSession: guardar((s) => repo.saveSession(s)),
    listRestDays: () => repo.listRestDays(),
    saveRestDay: guardar((r) => repo.saveRestDay(r)),
    deleteRestDay: guardar((date) => repo.deleteRestDay(date)),
    listProposals: () => repo.listProposals(),
    saveProposal: guardar((p) => repo.saveProposal(p)),
    listGoals: () => repo.listGoals(),
    saveGoal: guardar((g) => repo.saveGoal(g)),
    deleteGoal: guardar((id) => repo.deleteGoal(id)),
    listGoalChests: () => repo.listGoalChests(),
    saveGoalChest: guardar((b) => repo.saveGoalChest(b)),
    listIslandPurchases: () => repo.listIslandPurchases(),
    saveIslandPurchase: guardar((c) => repo.saveIslandPurchase(c)),
    listHousePurchases: () => repo.listHousePurchases(),
    saveHousePurchase: guardar((c) => repo.saveHousePurchase(c)),
    listRoomDecor: () => repo.listRoomDecor(),
    saveRoomDecor: guardar((d) => repo.saveRoomDecor(d)),
    moveRoomDecor: guardar((item, spot) => repo.moveRoomDecor(item, spot)),
    getJoiaCredit: () => repo.getJoiaCredit(),
    listTasks: () => repo.listTasks(),
    saveTask: guardar((t) => repo.saveTask(t)),
    deleteTask: guardar((id) => repo.deleteTask(id)),
    listSubtasks: () => repo.listSubtasks(),
    saveSubtask: guardar((s) => repo.saveSubtask(s)),
    deleteSubtask: guardar((taskId, id) => repo.deleteSubtask(taskId, id)),
    addTaskComment: guardar((c) => repo.addTaskComment(c)),
    listTaskActivity: (taskId) => repo.listTaskActivity(taskId),
    getMascotState: () => repo.getMascotState(),
    saveMascotState: guardar((m) => repo.saveMascotState(m)),
    clearAll: guardar(() => repo.clearAll()),
  };
  // O remoto conta os pomodoros com todo o histórico: sem repassar, a tela contaria só as sessões do sync.
  const contado: Repository | (Repository & PomodoroSource) = providesPomodoros(repo)
    ? { ...base, getPomodoros: () => repo.getPomodoros() }
    : base;
  // Repositório com escritas em lote (o remoto): o lote também avisa em caso de erro.
  if (!supportsBatch(repo)) return contado;
  const emLote: BatchRepository = {
    ...contado,
    saveBlocks: guardar((blocos) => repo.saveBlocks(blocos)),
    saveHabits: guardar((habitos) => repo.saveHabits(habitos)),
  };
  return emLote;
}

