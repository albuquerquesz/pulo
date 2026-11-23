import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Sobe um Postgres de teste (embedded-postgres, ou PULO_TEST_DATABASE_URL) com as migrações do @pulo/db.
    globalSetup: ['@pulo/db/testing/global-setup'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
