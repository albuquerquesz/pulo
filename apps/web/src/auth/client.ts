import { readUserMetadata, type UserMetadata, type UserMetadataPatch } from '@pulo/core/domain/user-metadata';
import { createAuthClient } from 'better-auth/react';

/** Endereço da API (apps/api), de .env.development ou .env.production. */
export const API_URL = import.meta.env.VITE_API_URL;

export const authClient = createAuthClient({
  baseURL: API_URL,
  // A sessão é um cookie da API: precisa ir junto em toda requisição.
  fetchOptions: { credentials: 'include' },
});

export type Conta = {
  user: { id: string; name: string; email: string; image: string | null };
  metadata: UserMetadata;
};

type RespostaDeMetadata = { metadata: UserMetadata };

async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (!resposta.ok) throw new Error(`API respondeu ${resposta.status} em ${caminho}`);
  return resposta.json();
}

/** Conta logada com os metadados já normalizados. */
export async function lerConta() {
  const conta = await chamar<Conta>('/api/me');
  return { ...conta, metadata: readUserMetadata(conta.metadata) };
}

export async function salvarMetadata(patch: UserMetadataPatch) {
  const { metadata } = await chamar<RespostaDeMetadata>('/api/me/metadata', { method: 'PATCH', body: JSON.stringify(patch) });
  return readUserMetadata(metadata);
}
