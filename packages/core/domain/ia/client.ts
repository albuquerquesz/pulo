import type { WeeklyAiRequest } from './request';

/**
 * Cliente da IA, injetável. Devolve a resposta CRUA (não confiável):
 * quem chama valida com `validateAiOutput`.
 */
export interface WeeklyAiClient {
  suggest(request: WeeklyAiRequest, options?: { signal?: AbortSignal }): Promise<unknown>;
}

/** Cliente falso para testes: o comportamento vem de uma função. */
export class FakeWeeklyAiClient implements WeeklyAiClient {
  readonly calls: WeeklyAiRequest[] = [];
  constructor(
    private readonly behavior: (
      request: WeeklyAiRequest,
      signal?: AbortSignal,
    ) => unknown | Promise<unknown>,
  ) {}

  async suggest(request: WeeklyAiRequest, options?: { signal?: AbortSignal }): Promise<unknown> {
    this.calls.push(request);
    return this.behavior(request, options?.signal);
  }
}

export interface HttpWeeklyAiClientOptions {
  /** URL da função de servidor. Nunca contém chave: a chave só existe em server/. */
  endpoint: string;
  fetchImpl?: typeof fetch;
}

export function createHttpWeeklyAiClient(opts: HttpWeeklyAiClientOptions): WeeklyAiClient {
  return {
    async suggest(request, options) {
      const f = opts.fetchImpl ?? fetch;
      const res = await f(opts.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        signal: options?.signal,
      });
      if (!res.ok) throw new Error(`ia_http_${res.status}`);
      return res.json();
    },
  };
}
