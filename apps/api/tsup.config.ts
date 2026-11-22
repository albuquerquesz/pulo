import { defineConfig } from 'tsup';

// O @pulo/core é TypeScript puro sem build próprio: entra no bundle da API.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  noExternal: [/^@pulo\//],
  clean: true,
});
