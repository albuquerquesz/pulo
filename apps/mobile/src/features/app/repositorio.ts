import { isRemoteError, mensagemDeErro, RemoteError } from '@pulo/client';
import { type BatchRepository, supportsBatch } from '@pulo/core/data/batch';
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
    getMascotState: () => repo.getMascotState(),
    saveMascotState: guardar((m) => repo.saveMascotState(m)),
    clearAll: guardar(() => repo.clearAll()),
  };
  // Repositório com escritas em lote (o remoto): o lote também avisa em caso de erro.
  if (!supportsBatch(repo)) return base;
  const emLote: BatchRepository = {
    ...base,
    saveBlocks: guardar((blocos) => repo.saveBlocks(blocos)),
    saveHabits: guardar((habitos) => repo.saveHabits(habitos)),
  };
  return emLote;
}

