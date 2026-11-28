import { isRemoteError, RemoteError } from '@pulo/client';
import { type BatchRepository, supportsBatch } from '@pulo/core/data/batch';
import { providesAchievements } from '@pulo/core/domain/achievements';
import { providesFreezes } from '@pulo/core/domain/gelo';
import { providesHabitStats } from '@pulo/core/domain/habit-stats';
import { providesFreezePurchases, providesJoiasForaDoCache } from '@pulo/core/domain/joias';
import { providesMetrics } from '@pulo/core/domain/metricas';
import { providesStats } from '@pulo/core/domain/stats';
import { providesStreak } from '@pulo/core/domain/streak';
import { providesPomodoros } from '@pulo/core/domain/tasks';
import type { FocusSession, Repository } from '@pulo/core/domain/types';

import { mensagemNaTela } from '../casca/erros';
import { temAvisosDeConquista, temConta, temDatasDoGelo, temPreferencias, temRecarga } from './conta';

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
    <A extends unknown[], R>(escrita: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      try {
        return await escrita(...args);
      } catch (erro) {
        if (isRemoteError(erro) && erro.kind === 'sessao') avisos.sessaoExpirou();
        else avisos.avisar(mensagemNaTela(erro));
        throw erro;
      }
    };
  /** Focos cujo encerramento já falhou e foi avisado: as novas tentativas do app ficam caladas até dar certo. */
  const focosAvisados = new Set<string>();
  const salvarSessao = async (sessao: FocusSession) => {
    try {
      await repo.saveSession(sessao);
      focosAvisados.delete(sessao.id);
    } catch (erro) {
      if (isRemoteError(erro) && erro.kind === 'sessao') avisos.sessaoExpirou();
      else if (!focosAvisados.has(sessao.id)) avisos.avisar(mensagemNaTela(erro));
      if (sessao.state === 'concluida') focosAvisados.add(sessao.id);
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
    saveSession: salvarSessao,
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
  // O que o remoto oferece além do contrato (todo o histórico, preferências e conta): sem repassar, a tela
  // calcularia só com o que veio no sync ou ficaria sem a função.
  const contado: Repository = {
    ...base,
    // A releitura é do app, não da pessoa: sem rede ela falha calada.
    ...(temRecarga(repo)
      ? {
          reload: async () => {
            try {
              await repo.reload();
            } catch (erro) {
              if (isRemoteError(erro) && erro.kind === 'sessao') avisos.sessaoExpirou();
              throw erro;
            }
          },
        }
      : {}),
    ...(providesPomodoros(repo) ? { getPomodoros: () => repo.getPomodoros() } : {}),
    ...(providesHabitStats(repo) ? { getHabitStats: (id: string) => repo.getHabitStats(id) } : {}),
    ...(providesStreak(repo) ? { getStreak: () => repo.getStreak() } : {}),
    ...(providesStats(repo) ? { getStats: () => repo.getStats() } : {}),
    ...(providesFreezes(repo)
      ? { getFreezes: () => repo.getFreezes(), buyFreeze: guardar(() => repo.buyFreeze()), markFreezesSeen: guardar(() => repo.markFreezesSeen()) }
      : {}),
    ...(providesFreezePurchases(repo) ? { listFreezePurchases: () => repo.listFreezePurchases() } : {}),
    ...(providesJoiasForaDoCache(repo) ? { getJoiasForaDaJanela: () => repo.getJoiasForaDaJanela() } : {}),
    ...(temDatasDoGelo(repo) ? { getFreezeDates: () => repo.getFreezeDates() } : {}),
    ...(providesMetrics(repo) ? { getMetrics: () => repo.getMetrics() } : {}),
    ...(providesAchievements(repo) ? { getAchievements: () => repo.getAchievements() } : {}),
    ...(temAvisosDeConquista(repo)
      ? { onNewAchievements: (ouvir: Parameters<typeof repo.onNewAchievements>[0]) => repo.onNewAchievements(ouvir) }
      : {}),
    ...(temPreferencias(repo)
      ? { getPreferences: () => repo.getPreferences(), savePreferences: guardar((patch: Parameters<typeof repo.savePreferences>[0]) => repo.savePreferences(patch)) }
      : {}),
    ...(temConta(repo)
      ? {
          exportData: guardar(() => repo.exportData()),
          listConnections: () => repo.listConnections(),
          disconnect: guardar((clientId: string) => repo.disconnect(clientId)),
          deleteAccount: guardar(() => repo.deleteAccount()),
        }
      : {}),
  };
  // Repositório com escritas em lote (o remoto): o lote também avisa em caso de erro.
  if (!supportsBatch(repo)) return contado;
  const emLote: BatchRepository = {
    ...contado,
    saveBlocks: guardar((blocos) => repo.saveBlocks(blocos)),
    saveHabits: guardar((habitos) => repo.saveHabits(habitos)),
  };
  return emLote;
}

