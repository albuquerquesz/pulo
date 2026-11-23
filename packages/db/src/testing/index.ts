// Apoio a testes com Postgres real. Só importe em arquivos de teste (usa vitest).
export { type QueryCount, createQueryRecorder } from './count-queries';
export { type TestDatabase, createTestDatabase } from './database';
export { type RunningPostgres, startEmbeddedPostgres } from './embedded';
export { applyMigrations } from './migrations';
