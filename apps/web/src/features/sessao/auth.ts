import { type FetchLike, MENSAGEM_SEM_SINAL, RemoteError } from '@pulo/client';
import { createAuthClient } from 'better-auth/client';

import { ambienteDoApp, apiUrl } from './config';

export interface PessoaLogada {
  id: string;
  nome: string;
  email: string;
  /** Endereço `https` da foto; ausente ou `null` mostra a inicial. */
  foto?: string | null;
}

export interface MudancaDeConta {
  nome: string;
  foto: string | null;
}

/** Opções de rede do `RemoteRepository`: o cookie da sessão é do navegador (HttpOnly), o app nunca o lê nem o guarda. */
export interface RedeDaSessao {
  baseUrl: string;
  /** Só para testes: troca o `fetch` do repositório remoto. */
  fetch?: FetchLike;
}

/** O que o app precisa da autenticação. Esconde o Better Auth atrás de uma interface pequena e testável. */
export interface Autenticacao {
  /** `null` = sem sessão. Lança `RemoteError` (`rede`) se não deu para falar com o servidor. */
  sessaoAtual(): Promise<PessoaLogada | null>;
  /** Abre o login do Google. A página sai para o Google e volta. */
  entrarComGoogle(): Promise<void>;
  /** Lança se o servidor não confirmou: a sessão continua valendo. */
  sair(): Promise<void>;
  /** Muda nome e foto da conta. Lança `RemoteError` (`sessao`) se a sessão acabou. */
  atualizarConta(mudanca: MudancaDeConta): Promise<void>;
  rede(): RedeDaSessao;
}

export const MENSAGEM_PERFIL = 'Não consegui salvar seu perfil. Tente de novo.';
export const MENSAGEM_LOGIN = 'Não consegui entrar com o Google. Tente de novo.';
export const MENSAGEM_SAIR = 'Não foi possível sair agora. Confira sua conexão e tente de novo.';
export const MENSAGEM_SESSAO_ACABOU = 'Sua sessão acabou. Entre de novo para continuar.';

/**
 * Para onde o servidor devolve a pessoa quando o login do Google falha ou é cancelado: a welcome, com o motivo
 * (`login` pelo app, `conexao` quando outro app pediu acesso).
 */
export function urlDeErroDoLogin(motivo: 'login' | 'conexao'): string {
  return `${window.location.origin}/welcome?erro=${motivo}`;
}

/**
 * Cliente do Better Auth no navegador. A sessão é um cookie HttpOnly gerido pelo servidor: as chamadas vão com
 * `credentials: 'include'` e nenhum token passa pelo JavaScript.
 */
export function criarAutenticacao(baseUrl: string): Autenticacao {
  const client = createAuthClient({ baseURL: baseUrl, fetchOptions: { credentials: 'include' } });
  return {
    sessaoAtual: () => lerSessao(client.getSession()),
    entrarComGoogle: async () => {
      // Volta para a própria página do app (a origem precisa estar em PULO_CORS_ORIGIN, as origens confiáveis da API).
      const resposta = await client.signIn
        .social({ provider: 'google', callbackURL: `${window.location.origin}/`, errorCallbackURL: urlDeErroDoLogin('login') })
        .catch(() => null);
      if (!resposta || resposta.error) throw new Error(MENSAGEM_LOGIN);
    },
    sair: async () => {
      // Sem a resposta do servidor o cookie HttpOnly continua valendo: quem chama precisa saber que não saiu.
      const resposta = await client.signOut().catch(() => null);
      if (!resposta || resposta.error) throw new Error(MENSAGEM_SAIR);
    },
    atualizarConta: async ({ nome, foto }) => {
      const resposta = await client.updateUser({ name: nome, image: foto }).catch(() => null);
      if (resposta?.error?.status === 401) throw new RemoteError({ kind: 'sessao', status: 401, mensagem: MENSAGEM_SESSAO_ACABOU });
      if (!resposta || resposta.error) throw new Error(MENSAGEM_PERFIL);
    },
    rede: () => ({ baseUrl }),
  };
}

interface RespostaDeSessao {
  data: { user: { id: string; name: string; email: string; image?: string | null } } | null;
  error: { status: number } | null;
}

async function lerSessao(pedido: Promise<RespostaDeSessao>): Promise<PessoaLogada | null> {
  let resposta: RespostaDeSessao;
  try {
    resposta = await pedido;
  } catch (cause) {
    throw new RemoteError({ kind: 'rede', mensagem: MENSAGEM_SEM_SINAL, cause });
  }
  if (resposta.data) return { id: resposta.data.user.id, nome: resposta.data.user.name, email: resposta.data.user.email, foto: resposta.data.user.image ?? null };
  // 4xx (sem cookie, sessão vencida) = sem login; 0 ou 5xx = o servidor não respondeu direito.
  if (resposta.error && (resposta.error.status === 0 || resposta.error.status >= 500)) {
    throw new RemoteError({ kind: 'rede', mensagem: MENSAGEM_SEM_SINAL });
  }
  return null;
}

/** O login do app: Better Auth no endereço de `VITE_API_URL`. `null` se não houver endereço. */
export function autenticacaoDoApp(): Autenticacao | null {
  const url = apiUrl(ambienteDoApp(), import.meta.env.DEV);
  return url ? criarAutenticacao(url) : null;
}
