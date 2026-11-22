import { serve } from '@hono/node-server';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: createApp(process.env).fetch, port }, (info) => {
  console.log(`API do Pulo em http://localhost:${info.port}`);
});
