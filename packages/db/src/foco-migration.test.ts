import pg from 'pg';
import { applyMigrations } from './testing/migrations';
import { type TestDatabase, createTestDatabase } from './testing';

const MIGRACAO = '20261129100000_foco_vinculo';
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

it('migração do foco: sessões antigas ficam sem vínculo, um alvo só, e apagar o alvo ou a conta funciona', async () => {
  await sql('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  await applyMigrations(t.url, (name) => name < MIGRACAO);
  await sql(`
    INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
    VALUES ('a', 'A', 'a@example.com', true, now(), now());
    INSERT INTO "focus_session" ("id", "userId", "startedAt", "endedAt", "plannedMinutes", "state")
    VALUES ('antiga', 'a', now(), now(), 25, 'concluida');
  `);
  await applyMigrations(t.url, (name) => name >= MIGRACAO);
  expect(
    await t.db.focusSession.findMany({ where: { intention: null, habitId: null, goalId: null, taskId: null }, select: { id: true } }),
  ).toEqual([{ id: 'antiga' }]);

  await t.db.habit.create({ data: { id: 'h', userId: 'a', title: 'ler', weekdays: [0] } });
  await t.db.goal.create({ data: { id: 'g', userId: 'a', title: 'x', state: 'ativa', milestones: [], createdAt: new Date() } });
  await expect(t.db.focusSession.update({ where: { id: 'antiga' }, data: { habitId: 'h', goalId: 'g' } })).rejects.toThrow();
  await t.db.focusSession.update({ where: { id: 'antiga' }, data: { habitId: 'h' } });

  await t.db.habit.delete({ where: { id: 'h' } });
  expect(await t.db.focusSession.findUnique({ where: { id: 'antiga' }, select: { habitId: true } })).toEqual({ habitId: null });

  await t.db.focusSession.update({ where: { id: 'antiga' }, data: { goalId: 'g' } });
  await t.db.user.delete({ where: { id: 'a' } });
  expect(await t.db.focusSession.count()).toBe(0);
});
