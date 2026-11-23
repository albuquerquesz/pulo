/** Endereços lidos do ambiente (EXPO_PUBLIC_*, embutidos no build). Veja .env.example. */
export interface Ambiente {
  EXPO_PUBLIC_API_URL?: string | undefined;
  EXPO_PUBLIC_WEEKLY_AI_ENDPOINT?: string | undefined;
}

/** API local do `wrangler dev`, só quando a variável não foi definida em desenvolvimento. */
export const API_LOCAL = 'http://localhost:8787';

function limpar(valor: string | undefined): string | null {
  const texto = valor?.trim().replace(/\/+$/, '');
  return texto ? texto : null;
}

/** Endereço da API sem barra no fim. `null` = não configurado (o login fica indisponível, o demo continua). */
export function apiUrl(env: Ambiente, emDesenvolvimento: boolean): string | null {
  return limpar(env.EXPO_PUBLIC_API_URL) ?? (emDesenvolvimento ? API_LOCAL : null);
}

/** IA semanal: o endereço próprio, se houver; senão `/weekly-ai` da mesma API; sem nenhum, as regras locais. */
export function endpointDaIa(env: Ambiente, emDesenvolvimento: boolean): string | undefined {
  const proprio = limpar(env.EXPO_PUBLIC_WEEKLY_AI_ENDPOINT);
  if (proprio) return proprio;
  const api = apiUrl(env, emDesenvolvimento);
  return api ? `${api}/weekly-ai` : undefined;
}

/** Lê o ambiente do app. As variáveis `process.env.EXPO_PUBLIC_*` precisam aparecer por extenso para o Metro embutir. */
export function ambienteDoApp(): Ambiente {
  return {
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_WEEKLY_AI_ENDPOINT: process.env.EXPO_PUBLIC_WEEKLY_AI_ENDPOINT,
  };
}
