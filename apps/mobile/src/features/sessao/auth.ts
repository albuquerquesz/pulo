import { expoClient } from '@better-auth/expo/client';
import { type FetchLike, MENSAGEM_SEM_SINAL, RemoteError } from '@pulo/client';
import { createAuthClient } from 'better-auth/client';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { ambienteDoApp, apiUrl } from './config';

export interface PessoaLogada {
  id: string;
  nome: string;
  email: string;
}

/** Opções de rede do `RemoteRepository` para a plataforma (cookie do navegador na web, cabeçalho Cookie no nativo). */
export interface RedeDaSessao {
  baseUrl: string;
  credentials: RequestCredentials;
  getHeaders?: () => HeadersInit | Promise<HeadersInit>;
  /** Só para testes: troca o `fetch` do repositório remoto. */
  fetch?: FetchLike;
}

/** O que o app precisa da autenticação. Esconde o Better Auth atrás de uma interface pequena e testável. */
export interface Autenticacao {
  /** `null` = sem sessão. Lança `RemoteError` (`rede`) se não deu para falar com o servidor. */
  sessaoAtual(): Promise<PessoaLogada | null>;
  /** Abre o login do Google. Na web a página sai para o Google e volta; no celular resolve ao voltar do navegador. */
  entrarComGoogle(): Promise<void>;
  sair(): Promise<void>;
  rede(): RedeDaSessao;
}

export const ESQUEMA_DO_APP = 'pulo';
const MENSAGEM_LOGIN = 'Não consegui entrar com o Google. Tente de novo.';

/** Cliente do Better Auth: navegador (cookie cross site com credenciais) ou nativo (plugin do Expo com SecureStore). */
export function criarAutenticacao(baseUrl: string): Autenticacao {
  return Platform.OS === 'web' ? autenticacaoWeb(baseUrl) : autenticacaoNativa(baseUrl);
}

function autenticacaoWeb(baseUrl: string): Autenticacao {
  const client = createAuthClient({ baseURL: baseUrl, fetchOptions: { credentials: 'include' } });
  return {
    sessaoAtual: () => lerSessao(client.getSession()),
    entrarComGoogle: async () => {
      // Volta para a própria página do app (a origem precisa estar em PULO_CORS_ORIGIN, as origens confiáveis da API).
      const { error } = await client.signIn.social({ provider: 'google', callbackURL: `${window.location.origin}/` });
      if (error) throw new Error(MENSAGEM_LOGIN);
    },
    sair: async () => void (await client.signOut()),
    rede: () => ({ baseUrl, credentials: 'include' }),
  };
}

function autenticacaoNativa(baseUrl: string): Autenticacao {
  const client = createAuthClient({
    baseURL: baseUrl,
    plugins: [expoClient({ scheme: ESQUEMA_DO_APP, storagePrefix: ESQUEMA_DO_APP, storage: SecureStore })],
  });
  return {
    sessaoAtual: () => lerSessao(client.getSession()),
    entrarComGoogle: async () => {
      const { error } = await client.signIn.social({ provider: 'google', callbackURL: '/' });
      if (error) throw new Error(MENSAGEM_LOGIN);
    },
    sair: async () => void (await client.signOut()),
    // O cookie fica no SecureStore: vai à mão no cabeçalho, e `omit` evita o conflito com o do sistema.
    rede: () => ({ baseUrl, credentials: 'omit', getHeaders: async () => ({ cookie: await client.getCookie() }) }),
  };
}

interface RespostaDeSessao {
  data: { user: { id: string; name: string; email: string } } | null;
  error: { status: number } | null;
}

async function lerSessao(pedido: Promise<RespostaDeSessao>): Promise<PessoaLogada | null> {
  let resposta: RespostaDeSessao;
  try {
    resposta = await pedido;
  } catch (cause) {
    throw new RemoteError({ kind: 'rede', mensagem: MENSAGEM_SEM_SINAL, cause });
  }
  if (resposta.data) return { id: resposta.data.user.id, nome: resposta.data.user.name, email: resposta.data.user.email };
  // 4xx (sem cookie, sessão vencida) = sem login; 0 ou 5xx = o servidor não respondeu direito.
  if (resposta.error && (resposta.error.status === 0 || resposta.error.status >= 500)) {
    throw new RemoteError({ kind: 'rede', mensagem: MENSAGEM_SEM_SINAL });
  }
  return null;
}

/** O login do app: Better Auth no endereço de `EXPO_PUBLIC_API_URL`. `null` se não houver endereço (só o demo funciona). */
export function autenticacaoDoApp(): Autenticacao | null {
  const url = apiUrl(ambienteDoApp(), __DEV__);
  return url ? criarAutenticacao(url) : null;
}
