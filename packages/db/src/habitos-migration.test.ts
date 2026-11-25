import pg from 'pg';
import { applyMigrations } from './testing/migrations';
import { type TestDatabase, createTestDatabase } from './testing';

const MIGRACAO = '20261128100000_habitos_v2';
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

const estados = () => t.db.habit.findMany({ select: { id: true, state: true, active: true }, orderBy: { id: 'asc' } });

it('migração dos hábitos: active vira state sem perder nada, e a coluna antiga continua coerente', async () => {
  await sql('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  await applyMigrations(t.url, (name) => name < MIGRACAO);
  await sql(`
    INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
    VALUES ('a', 'A', 'a@example.com', true, now(), now());
    INSERT INTO "habit" ("id", "userId", "title", "weekdays", "active") VALUES
      ('ligado', 'a', 'ler', '{0}', true), ('desligado', 'a', 'correr', '{1}', false);
    INSERT INTO "habit_log" ("habitId", "userId", "date", "doneAt") VALUES ('desligado', 'a', '2026-11-03', now());
    INSERT INTO "routine_block" ("id", "userId", "weekday", "startMinutes", "durationMinutes", "kind") VALUES ('b', 'a', 0, 540, 25, 'foco');
  `);
  await applyMigrations(t.url, (name) => name >= MIGRACAO);

  expect(await estados()).toEqual([
    { id: 'desligado', state: 'arquivado', active: false },
    { id: 'ligado', state: 'ativo', active: true },
  ]);
  expect(await t.db.habitLog.count()).toBe(1);
  expect(await t.db.habit.findMany({ where: { createdAt: null, icon: null, period: null, reminderOn: false } })).toHaveLength(2);
  expect(await t.db.routineBlock.findMany({ select: { id: true, icon: true } })).toEqual([{ id: 'b', icon: null }]);

  // Escritas da API anterior (só conhecem `active`) durante o deploy, inclusive o upsert dela.
  await sql(`
    INSERT INTO "habit" ("id", "userId", "title", "weekdays", "active") VALUES ('novo', 'a', 'x', '{0}', false);
    UPDATE "habit" SET "active" = false WHERE "id" = 'ligado';
    INSERT INTO "habit" ("id", "userId", "title", "weekdays", "active") VALUES ('desligado', 'a', 'correr', '{1}', true)
    ON CONFLICT ("id") DO UPDATE SET "active" = EXCLUDED."active";
  `);
  expect(await estados()).toEqual([
    { id: 'desligado', state: 'ativo', active: true },
    { id: 'ligado', state: 'arquivado', active: false },
    { id: 'novo', state: 'arquivado', active: false },
  ]);

  // Escritas novas (só conhecem `state`).
  await t.db.habit.update({ where: { id: 'desligado' }, data: { state: 'pausado' } });
  await t.db.habit.update({ where: { id: 'ligado' }, data: { state: 'ativo' } });
  await t.db.habit.create({ data: { id: 'pausa', userId: 'a', title: 'x', weekdays: [0], state: 'pausado' } });
  // A API anterior regravando um pausado como inativo não o arquiva.
  await sql(`UPDATE "habit" SET "active" = false, "title" = 'y' WHERE "id" = 'desligado'`);
  expect(await estados()).toEqual([
    { id: 'desligado', state: 'pausado', active: false },
    { id: 'ligado', state: 'ativo', active: true },
    { id: 'novo', state: 'arquivado', active: false },
    { id: 'pausa', state: 'pausado', active: false },
  ]);
  expect((await t.db.habit.findUniqueOrThrow({ where: { id: 'pausa' } })).createdAt).not.toBeNull();
  await expect(t.db.habit.update({ where: { id: 'pausa' }, data: { reminderMinutes: 1440 } })).rejects.toThrow();
});
