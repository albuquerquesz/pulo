// Config só para `npx auth generate`: mesmo auth da API, com SQLite em memória no lugar do D1.
import { DatabaseSync } from 'node:sqlite';
import { createAuth } from './src/auth';

export const auth = createAuth(
  {
    DB: { prepare: () => { throw new Error('sem D1'); }, batch: async () => [], exec: async () => null },
    BETTER_AUTH_SECRET: 'schema-generation-only-secret-000000000000',
    BETTER_AUTH_URL: 'http://localhost:8787',
    GOOGLE_CLIENT_ID: 'x',
    GOOGLE_CLIENT_SECRET: 'x',
  },
  [],
  new DatabaseSync(':memory:'),
);
