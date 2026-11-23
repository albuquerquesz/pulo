import type { AppType } from '@pulo/api/src/app';
import { hc } from 'hono/client';
import { MENSAGENS_DA_API, RemoteError, errorFromResponse, networkError } from './errors';

/** Qualquer `fetch`: o global, o do React Native ou `app.fetch` do Hono (que só aceita um `Request`). */
export type FetchLike = (request: Request) => Response | Promise<Response>;

export interface ApiOptions {
  /** Endereço da API, sem barra no fim (ex.: https://pulo-api.exemplo.workers.dev). */
  baseUrl: string;
  /** Padrão: `fetch` global. */
  fetch?: FetchLike;
}

/** Cliente `hc<AppType>`: rotas, corpos e respostas inferidos da própria API, sem `any`. */
export function createApiClient(options: ApiOptions) {
  const send: FetchLike = options.fetch ?? ((request) => fetch(request));

  return hc<AppType>(options.baseUrl.replace(/\/+$/, ''), {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        // `include`: o navegador manda o cookie HttpOnly da sessão para a API (mesmo site ou outro site, com CORS).
        return await send(new Request(input, { ...init, credentials: 'include' }));
      } catch (error) {
        throw error instanceof RemoteError ? error : networkError(error);
      }
    },
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Lê o JSON de uma resposta 2xx; qualquer outra vira `RemoteError` com texto em português. */
export async function readJson<T>(response: { ok: boolean; status: number; json(): Promise<T> }): Promise<T> {
  if (!response.ok) throw await errorFromResponse(response);
  try {
    return await response.json();
  } catch (cause) {
    throw new RemoteError({
      kind: 'resposta_invalida',
      status: response.status,
      mensagem: MENSAGENS_DA_API.erro_interno,
      cause,
    });
  }
}
