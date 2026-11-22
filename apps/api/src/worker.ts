import { type ApiEnv, createApp } from './app';

// Entrada do Cloudflare Worker. O ambiente (vars e secrets) chega a cada requisição.
export default {
  fetch: (request: Request, env: ApiEnv) => createApp(env).fetch(request),
};
