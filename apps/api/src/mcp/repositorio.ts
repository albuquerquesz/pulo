import { apiErrorSchema } from '@pulo/core/api/schemas';
import type { Repository } from '@pulo/core/domain/types';
import { metadataPatchFromUser, userFromMetadata } from '@pulo/core/domain/user-metadata';
import { hc } from 'hono/client';
import type { AppType } from '../app';

/** Como o MCP chama a própria API: `app.fetch` com a pessoa do token já verificada (sem rede, sem cookie). */
export type ChamadaInterna = (request: Request) => Promise<Response>;

/** Base fictícia: a requisição nunca sai do Worker. */
const BASE_INTERNA = 'http://pulo.interno';

/** Erro de regra ou de validação da API, com o texto em português que a tela também mostraria. */
export class ErroDaApi extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type RespostaJson<T> = { ok: boolean; status: number; json(): Promise<T>; text(): Promise<string> };

export async function lerJson<T>(resposta: RespostaJson<T>): Promise<T> {
  if (resposta.ok) return resposta.json();
  const texto = await resposta.text();
  const corpo = apiErrorSchema.safeParse(JSON.parse(texto || 'null'));
  if (!corpo.success) throw new ErroDaApi(resposta.status, 'erro_interno', 'Algo deu errado no servidor.');
  throw new ErroDaApi(resposta.status, corpo.data.error, corpo.data.message ?? corpo.data.error);
}

export function clienteInterno(chamar: ChamadaInterna) {
  return hc<AppType>(BASE_INTERNA, { fetch: (input: RequestInfo | URL, init?: RequestInit) => chamar(new Request(input, init)) });
}

export type ClienteInterno = ReturnType<typeof clienteInterno>;

/**
 * O `Repository` do core sobre as rotas da própria API. Cada leitura e escrita passa pelas mesmas validações,
 * limites e transações que o app usa, então as ferramentas do MCP rodam os casos de uso do core sem atalhos.
 * Sem cache: uma chamada de ferramenta é curta e sempre lê o estado atual.
 */
export function repositorioInterno(api: ClienteInterno): Repository {
  return {
    getUser: async () => {
      const { user, metadata } = await lerJson(await api.api.me.$get());
      return userFromMetadata(user.id, metadata);
    },
    saveUser: async (user) => {
      await lerJson(await api.api.me.metadata.$patch({ json: metadataPatchFromUser(user) }));
    },

    listBlocks: async () => (await lerJson(await api.api.blocks.$get())).blocks,
    saveBlock: async (block) => {
      await lerJson(await api.api.blocks[':id'].$put({ param: { id: block.id }, json: block }));
    },
    deleteBlock: async (id) => {
      await lerJson(await api.api.blocks[':id'].$delete({ param: { id } }));
    },

    listHabits: async () => (await lerJson(await api.api.habits.$get())).habits,
    saveHabit: async (habit) => {
      await lerJson(await api.api.habits[':id'].$put({ param: { id: habit.id }, json: habit }));
    },
    deleteHabit: async (id) => {
      await lerJson(await api.api.habits[':id'].$delete({ param: { id } }));
    },
    listHabitLogs: async (range) => (await lerJson(await api.api['habit-logs'].$get({ query: range ?? {} }))).habitLogs,
    saveHabitLog: async (log) => {
      await lerJson(await api.api['habit-logs'][':habitId'][':date'].$put({ param: { habitId: log.habitId, date: log.date }, json: log }));
    },
    deleteHabitLog: async (habitId, date) => {
      await lerJson(await api.api['habit-logs'][':habitId'][':date'].$delete({ param: { habitId, date } }));
    },

    listSessions: async () => (await lerJson(await api.api.sessions.$get({ query: {} }))).sessions,
    saveSession: async (session) => {
      await lerJson(await api.api.sessions[':id'].$put({ param: { id: session.id }, json: session }));
    },

    listRestDays: async () => (await lerJson(await api.api['rest-days'].$get({ query: {} }))).restDays,
    saveRestDay: async (restDay) => {
      await lerJson(await api.api['rest-days'][':date'].$put({ param: { date: restDay.date } }));
    },
    deleteRestDay: async (date) => {
      await lerJson(await api.api['rest-days'][':date'].$delete({ param: { date } }));
    },

    listProposals: async () => (await lerJson(await api.api.proposals.$get())).proposals,
    saveProposal: async (proposal) => {
      await lerJson(await api.api.proposals[':id'].$put({ param: { id: proposal.id }, json: proposal }));
    },

    listGoals: async () => (await lerJson(await api.api.goals.$get())).goals,
    saveGoal: async (goal) => {
      await lerJson(await api.api.goals[':id'].$put({ param: { id: goal.id }, json: goal }));
    },
    deleteGoal: async (id) => {
      await lerJson(await api.api.goals[':id'].$delete({ param: { id } }));
    },

    listIslandPurchases: async () => (await lerJson(await api.api.island.purchases.$get())).purchases,
    saveIslandPurchase: async (purchase) => {
      await lerJson(await api.api.island.purchases[':item'].$put({ param: { item: purchase.item }, json: purchase }));
    },

    getMascotState: async () => (await lerJson(await api.api.mascot.$get())).mascot,
    // O servidor calcula o sapo ao gravar sessões e descansos.
    saveMascotState: async () => undefined,

    clearAll: async () => {
      await lerJson(await api.api.data.$delete());
      await lerJson(await api.api.me.metadata.$patch({ json: { profile: null, onboardingCompleted: false } }));
    },
  };
}
