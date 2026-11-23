/**
 * De onde vêm os dados do app. Única regra de decisão (usada só pelo AppProvider):
 * - demo pedido (`?demo=1` ou botão): memória com dados sintéticos, sem login, nunca toca o servidor;
 * - com sessão: o servidor, pelo RemoteRepository;
 * - sem sessão e sem demo: tela de login.
 */
export type Origem = 'demo' | 'remoto' | 'login';

export function escolherOrigem(entrada: { demo: boolean; temSessao: boolean }): Origem {
  if (entrada.demo) return 'demo';
  return entrada.temSessao ? 'remoto' : 'login';
}
