/** Endereços lidos do ambiente (VITE_*, embutidos no build). Veja .env.development e .env.production. */
export interface Ambiente {
  VITE_API_URL?: string | undefined;
  VITE_WEEKLY_AI_ENDPOINT?: string | undefined;
}

/** API local do `wrangler dev`, só quando a variável não foi definida em desenvolvimento. */
export const API_LOCAL = 'http://localhost:8787';

function limpar(valor: string | undefined): string | null {
  const texto = valor?.trim().replace(/\/+$/, '');
  return texto ? texto : null;
}

/** Endereço da API sem barra no fim. `null` = não configurado (o login fica indisponível, o demo continua). */
export function apiUrl(env: Ambiente, emDesenvolvimento: boolean): string | null {
  return limpar(env.VITE_API_URL) ?? (emDesenvolvimento ? API_LOCAL : null);
}

/** IA semanal: o endereço próprio, se houver; senão `/weekly-ai` da mesma API; sem nenhum, as regras locais. */
export function endpointDaIa(env: Ambiente, emDesenvolvimento: boolean): string | undefined {
  const proprio = limpar(env.VITE_WEEKLY_AI_ENDPOINT);
  if (proprio) return proprio;
  const api = apiUrl(env, emDesenvolvimento);
  return api ? `${api}/weekly-ai` : undefined;
}

/** Lê o ambiente do app. As variáveis `import.meta.env.VITE_*` precisam aparecer por extenso para o Vite embutir. */
export function ambienteDoApp(): Ambiente {
  return {
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_WEEKLY_AI_ENDPOINT: import.meta.env.VITE_WEEKLY_AI_ENDPOINT,
  };
}
