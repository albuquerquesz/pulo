// Apoio só para os testes da conta: uma linha em cada tabela que guarda algo de uma pessoa.
import type { TestDatabase } from '@pulo/db/testing';
import { TEST_NOW } from './testing';

const at = new Date(TEST_NOW);
const later = new Date(TEST_NOW + 3_600_000);
const day = new Date(Date.UTC(2026, 10, 16));

/**
 * Semeia `rows` registros do domínio e uma linha de cada tabela de login e OAuth. `mark` aparece em todos os textos e
 * segredos, para os testes procurarem vazamentos.
 */
export async function seedEverything({ db }: TestDatabase, userId: string, mark: string, rows = 1) {
  const list = Array.from({ length: rows }, (_, i) => i);
  const id = (kind: string, i = 0) => `${mark}-${kind}-${i}`;
  await db.routineBlock.createMany({ data: list.map((i) => ({ id: id('bloco', i), userId, weekday: 1, startMinutes: 480, durationMinutes: 30, kind: 'foco' as const, title: id('titulo', i) })) });
  await db.habit.createMany({ data: list.map((i) => ({ id: id('habito', i), userId, title: id('ler', i), weekdays: [0], active: true })) });
  await db.habitLog.createMany({ data: list.map((i) => ({ userId, habitId: id('habito', i), date: day, doneAt: at })) });
  await db.focusSession.createMany({
    data: list.map((i) => ({ id: id('sessao', i), userId, startedAt: new Date(TEST_NOW - 30 * 60_000), endedAt: at, plannedMinutes: 25, state: 'concluida' as const })),
  });
  await db.restDay.createMany({ data: list.map((i) => ({ userId, date: new Date(Date.UTC(2026, 0, 1 + i)) })) });
  await db.weeklyProposal.createMany({
    data: list.map((i) => ({ id: id('proposta', i), userId, weekStart: new Date(Date.UTC(2026, 0, 5 + 7 * i)), state: 'pendente' as const, patternText: id('padrao', i), changes: [], origin: 'regra' as const, createdAt: at })),
  });
  await db.goal.createMany({ data: list.map((i) => ({ id: id('meta', i), userId, title: id('meta-titulo', i), state: 'ativa' as const, milestones: [], createdAt: at })) });
  await db.task.createMany({
    data: list.map((i) => ({ id: id('tarefa', i), userId, number: i + 1, title: id('tarefa-titulo', i), status: 'afazer' as const, position: i, priority: 'normal' as const, tags: [], goalId: id('meta', i), pomodorosEstimated: 0, createdAt: at })),
  });
  await db.taskSubtask.createMany({ data: list.map((i) => ({ id: id('sub', i), userId, taskId: id('tarefa', i), title: id('passo', i), done: false, position: 1 })) });
  await db.taskComment.createMany({ data: list.map((i) => ({ id: id('comentario', i), userId, taskId: id('tarefa', i), body: id('texto', i), createdAt: at })) });
  await db.taskEvent.createMany({ data: list.map((i) => ({ id: id('evento', i), userId, taskId: id('tarefa', i), kind: 'criada' as const, createdAt: at })) });
  await db.taskCounter.create({ data: { userId, last: rows } });
  await db.islandPurchase.createMany({
    data: [
      { userId, item: 'banco', kind: 'antiga', cost: 8, createdAt: at },
      { userId, item: 'cerca', kind: 'casa', cost: 40, createdAt: at },
      { userId, item: 'tapete', kind: 'decoracao', cost: 10, createdAt: at },
    ],
  });
  await db.roomPlacement.create({ data: { userId, item: 'tapete', x: 1, y: 2, rotation: 90 } });
  await db.joiaCredit.create({ data: { userId, amount: 7 } });
  await db.mascotState.create({ data: { userId, phase: 2, careDays: 4, updatedAt: at } });

  // Login e OAuth: os segredos que nunca podem sair na exportação.
  await db.account.create({
    data: { id: id('conta'), accountId: id('google'), providerId: 'google', userId, accessToken: id('SEGREDO-acesso'), refreshToken: id('SEGREDO-renovacao'), idToken: id('SEGREDO-id'), password: id('SEGREDO-senha'), createdAt: at, updatedAt: at },
  });
  const clientId = id('cliente');
  await db.oauthClient.create({ data: { id: id('oauth-cliente'), clientId, clientSecret: id('SEGREDO-cliente'), userId, name: 'Claude', redirectUris: [], createdAt: at } });
  await db.oauthConsent.create({ data: { id: id('consentimento'), clientId, userId, scopes: ['openid'], createdAt: at, updatedAt: at } });
  await db.oauthRefreshToken.create({ data: { id: id('renovacao'), token: id('SEGREDO-token-renovacao'), clientId, userId, scopes: [], expiresAt: later } });
  await db.oauthAccessToken.create({ data: { id: id('acesso'), token: id('SEGREDO-token-acesso'), clientId, userId, scopes: [], expiresAt: later } });
  await db.verification.create({
    data: { id: id('verificacao'), identifier: id('SEGREDO-codigo'), value: JSON.stringify({ userId, query: { client_id: clientId } }), expiresAt: later, createdAt: at, updatedAt: at },
  });
  return { clientId };
}

/** Todas as tabelas com coluna `userId`, lidas do próprio banco: uma tabela nova entra aqui sozinha. */
export async function userTables({ db }: TestDatabase): Promise<string[]> {
  const rows = await db.$queryRaw<{ table_name: string }[]>`
    SELECT table_name::text FROM information_schema.columns
    WHERE table_schema = current_schema() AND column_name = 'userId' ORDER BY table_name`;
  return rows.map((r) => r.table_name);
}

/** Linhas de uma pessoa em cada tabela com `userId`. */
export async function rowsByTable(database: TestDatabase, userId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of await userTables(database)) {
    // O nome vem do catálogo do próprio banco de teste.
    const [row] = await database.db.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "${table}" WHERE "userId" = $1`, userId);
    counts[table] = row.n;
  }
  return counts;
}
