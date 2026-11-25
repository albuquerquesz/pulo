// Dados SINTÉTICOS para desenvolvimento local. Nunca rode contra produção.
// Uso: DATABASE_URL=... npm run db:seed (na raiz).
import type { FocusSession, Habit, RoutineBlock } from '@pulo/core/domain/types';
import { loadRootEnv } from './load-env';
import { createDb } from '../src/client';
import { dateKeyToDate } from '../src/dates';
import {
  focusSessionMapper,
  habitLogMapper,
  habitMapper,
  mascotStateMapper,
  restDayMapper,
  routineBlockMapper,
} from '../src/mappers';

loadRootEnv();

const SEED_USER_ID = 'seed-user-demo';
const url = process.env.DATABASE_URL;
if (!url) throw new Error('Defina DATABASE_URL (veja .env.example).');
if (new URL(url).hostname !== 'localhost' && new URL(url).hostname !== '127.0.0.1' && process.env.PULO_SEED_ALLOW_REMOTE !== '1') {
  throw new Error('O seed só roda em banco local. Para forçar, defina PULO_SEED_ALLOW_REMOTE=1.');
}

const DAY_MS = 86_400_000;
const START = Date.UTC(2026, 10, 16, 12); // segunda, 16/11/2026 (sintético)

function dateKey(offsetDays: number): string {
  return new Date(START + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

const db = createDb(url);
try {
  // Recomeça só os dados desta pessoa sintética (cascade apaga o resto).
  await db.user.deleteMany({ where: { id: SEED_USER_ID } });
  await db.user.create({
    data: { id: SEED_USER_ID, name: 'Pessoa Demo', email: 'demo@pulo.example', emailVerified: true, createdAt: new Date(START), updatedAt: new Date(START) },
  });

  const blocks = [
    { id: 'seed-b1', weekday: 0, startMinutes: 540, durationMinutes: 25, kind: 'foco', title: 'Estudar' },
    { id: 'seed-b2', weekday: 2, startMinutes: 900, durationMinutes: 25, kind: 'foco' },
    { id: 'seed-b3', weekday: 4, startMinutes: 600, durationMinutes: 15, kind: 'descanso' },
  ] satisfies RoutineBlock[];
  await db.routineBlock.createMany({
    data: blocks.map((block) => routineBlockMapper.fromDomain(SEED_USER_ID, block)),
  });

  const habits = [
    { id: 'seed-h1', title: 'Alongar', weekdays: [0, 1, 2, 3, 4], state: 'ativo' },
    { id: 'seed-h2', title: 'Ler dez minutos', weekdays: [0, 2, 4, 6], state: 'ativo' },
  ] satisfies Habit[];
  await db.habit.createMany({ data: habits.map((habit) => habitMapper.fromDomain(SEED_USER_ID, habit)) });
  await db.habitLog.createMany({
    data: [0, 1, 2].map((day) =>
      habitLogMapper.fromDomain(SEED_USER_ID, { habitId: 'seed-h1', date: dateKey(day), doneAt: START + day * DAY_MS }),
    ),
  });

  const sessions = [
    { id: 'seed-f1', blockId: 'seed-b1', startedAt: START, endedAt: START + 25 * 60_000, plannedMinutes: 25, state: 'concluida', pausedMs: 0 },
  ] satisfies FocusSession[];
  await db.focusSession.createMany({
    data: sessions.map((session) => focusSessionMapper.fromDomain(SEED_USER_ID, session)),
  });
  await db.restDay.create({ data: restDayMapper.fromDomain(SEED_USER_ID, { date: dateKey(5) }) });
  await db.mascotState.create({ data: mascotStateMapper.fromDomain(SEED_USER_ID, { phase: 2, careDays: 4, updatedAt: START }) });

  console.log(`Seed pronto: usuário ${SEED_USER_ID} com dados sintéticos (${dateKeyToDate(dateKey(0)).toISOString().slice(0, 10)}).`);
} finally {
  await db.$disconnect();
}
