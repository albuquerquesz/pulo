import { defineConfig } from 'vitest/config';

// Separado do vite.config: os testes não sobem o Worker nem o TanStack Start.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/testing/setup.ts'],
  },
});
