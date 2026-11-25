import pg from 'pg';
import { applyMigrations } from './testing/migrations';
import { type TestDatabase, createTestDatabase } from './testing';

const MIGRACAO = '20261126100000_metas_v2';
let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase();
});
afterAll(async () => {
  await t.close();
});

async function sql(text: string) {
  const client = new pg.Client({ connectionString: t.url });
  await client.connect();
  try {
    await client.query(text);
  } finally {
    await client.end();
  }
}

it('migração das metas: preserva metas e hábitos e abre o baú das que já estavam concluídas', async () => {
  await sql('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  await applyMigrations(t.url, (name) => name < MIGRACAO);
  await sql(`
    INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
    VALUES ('a', 'A', 'a@example.com', true, now(), now());
    INSERT INTO "goal" ("id", "userId", "title", "state", "milestones", "createdAt", "completedAt") VALUES
      ('feita', 'a', 'x', 'concluida', '[]', '2026-11-01T10:00:00Z', '2026-11-05T10:00:00Z'),
      ('aberta', 'a', 'y', 'ativa', '[]', '2026-11-02T10:00:00Z', NULL);
    INSERT INTO "habit" ("id", "userId", "title", "weekdays", "active") VALUES ('h', 'a', 'ler', '{0}', true);
  `);
  await applyMigrations(t.url, (name) => name >= MIGRACAO);

  expect(await t.db.goal.findMany({ select: { id: true, icon: true, color: true }, orderBy: { id: 'asc' } })).toEqual([
    { id: 'aberta', icon: null, color: null },
    { id: 'feita', icon: null, color: null },
  ]);
  expect(await t.db.habit.findMany({ select: { id: true, goalId: true } })).toEqual([{ id: 'h', goalId: null }]);
  // A hora é comparada dentro do banco (a conexão de teste pode usar outro fuso).
  expect(
    await t.db.$queryRaw`
      SELECT c."userId", c."goalId", c."joias", c."abertoEm" = g."completedAt" AS "naConclusao"
      FROM "goal_chest" c JOIN "goal" g ON g."id" = c."goalId"`,
  ).toEqual([{ userId: 'a', goalId: 'feita', joias: 10, naConclusao: true }]);
});
