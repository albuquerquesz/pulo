import pg from 'pg';
import { applyMigrations } from './testing/migrations';
import { type TestDatabase, createTestDatabase } from './testing';

const MIGRACAO = '20261202100000_comodos';
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

it('migração dos cômodos: a decoração que já existe fica no quarto, e as partes compradas ficam', async () => {
  await sql('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  await applyMigrations(t.url, (name) => name < MIGRACAO);
  await sql(`
    INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
    VALUES ('a', 'A', 'a@example.com', true, now(), now());
    INSERT INTO "island_purchase" ("userId", "item", "kind", "cost", "createdAt")
    VALUES ('a', 'cerca', 'casa', 40, now()), ('a', 'tapete', 'decoracao', 10, now());
    INSERT INTO "room_placement" ("userId", "item", "x", "y", "rotation") VALUES ('a', 'tapete', 1, 2, 90);
  `);
  await applyMigrations(t.url, (name) => name >= MIGRACAO);

  expect(await t.db.roomPlacement.findMany()).toEqual([{ userId: 'a', item: 'tapete', x: 1, y: 2, rotation: 90, comodo: 'quarto' }]);
  expect(await t.db.islandPurchase.count({ where: { userId: 'a', kind: 'casa' } })).toBe(1);
});
