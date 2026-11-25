import pg from 'pg';
import { applyMigrations } from './testing/migrations';
import { type TestDatabase, createTestDatabase } from './testing';

const MIGRACAO = '20261124180000_joias_casa';
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

it('migração das joias: preserva as compras antigas e credita o que o foco perderia', async () => {
  await sql('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  await applyMigrations(t.url, (name) => name < MIGRACAO);
  const sessao = (id: string, user: string, state: string, planned: number, minutes: number) =>
    `('${id}', '${user}', '2026-11-01T10:00:00Z', timestamptz '2026-11-01T10:00:00Z' + interval '${minutes} minutes', ${planned}, '${state}', 0)`;
  await sql(`
    INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
    VALUES ('a', 'A', 'a@example.com', true, now(), now()), ('b', 'B', 'b@example.com', true, now(), now());
    INSERT INTO "island_purchase" ("userId", "item", "cost", "createdAt") VALUES ('a', 'praia', 40, now()), ('a', 'banco', 8, now());
    INSERT INTO "focus_session" ("id", "userId", "startedAt", "endedAt", "plannedMinutes", "state", "pausedMs") VALUES
      ${sessao('s1', 'a', 'concluida', 15, 4)},
      ${sessao('s2', 'a', 'interrompida', 15, 8)},
      ${sessao('s3', 'a', 'interrompida', 50, 4)},
      ${sessao('s4', 'b', 'concluida', 50, 50)};
  `);
  await applyMigrations(t.url, (name) => name >= MIGRACAO);

  expect(await t.db.islandPurchase.findMany({ select: { item: true, cost: true, kind: true }, orderBy: { item: 'asc' } })).toEqual([
    { item: 'banco', cost: 8, kind: 'antiga' },
    { item: 'praia', cost: 40, kind: 'antiga' },
  ]);
  // `a`: valia 3 + 3 + 0 = 6; passa a valer 0 + 1 + 0 = 1. `b` ganha mais com a regra nova e não precisa de crédito.
  expect(await t.db.joiaCredit.findMany()).toEqual([{ userId: 'a', amount: 5 }]);
});
