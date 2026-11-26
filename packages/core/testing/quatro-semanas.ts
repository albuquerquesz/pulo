import type {
  FocusSession,
  FreezeUse,
  Habit,
  HabitLog,
  RestDay,
  RoutineBlock,
  Clock,
  Repository,
  User,
  Weekday,
} from '../domain/types';
import { DEFAULT_DAY_START_HOUR, FOCUS } from '../config/decisions';
import { addDays, weekdayOf } from '../domain/day';
import { providesFreezeStore } from '../domain/gelo-store';
import { refreshMascotState } from '../domain/phase';
import { TZ } from '../domain/test-utils';

import { localToMs } from './relogio';

/** Segunda da primeira das 4 semanas sintéticas. A última termina em 22/11/2026. */
const PRIMEIRA_SEGUNDA = '2026-10-26';
const SEMANAS = 4;
const SEMENTE = 20261121;

interface DadosDeExemplo {
  user: User;
  blocks: RoutineBlock[];
  habits: Habit[];
  habitLogs: HabitLog[];
  sessions: FocusSession[];
  restDays: RestDay[];
  /** Um dia esquecido que o gelo salvou (spec 29). */
  freezeUses: FreezeUse[];
}

/** PRNG determinístico (mulberry32). */
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MORNING_START = 9 * 60;
const AFTERNOON_START = 14 * 60 + 30;
const BLOCK_MINUTES = 25;
const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4];

/**
 * 4 semanas sintéticas e coerentes, só dados inventados.
 * Padrão para a IA: manhãs com focos concluídos; tardes com interrupções. A semana 1 tem dias sem registro (sem culpa) e um descanso.
 * Em cada semana, de segunda a sexta, há foco; sábado é descanso.
 */
export function gerarQuatroSemanas(seed: number = SEMENTE, createdAt = 0): DadosDeExemplo {
  const rnd = createRng(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

  const user: User = {
    id: 'ex-user',
    frogName: 'Sapo de exemplo',
    timezone: TZ,
    dayStartMinutes: 7 * 60,
    dayEndMinutes: 22 * 60,
    theme: 'sistema',
    reduceMotion: false,
    createdAt,
  };

  const blocks: RoutineBlock[] = [];
  for (const wd of WEEKDAYS) {
    blocks.push({ id: `ex-bloco-manha-${wd}`, weekday: wd, startMinutes: MORNING_START, durationMinutes: BLOCK_MINUTES, kind: 'foco', title: 'Foco da manhã' });
    blocks.push({ id: `ex-bloco-tarde-${wd}`, weekday: wd, startMinutes: AFTERNOON_START, durationMinutes: BLOCK_MINUTES, kind: 'foco', title: 'Foco da tarde' });
  }
  blocks.push({ id: 'ex-bloco-descanso-5', weekday: 5, startMinutes: 10 * 60, durationMinutes: 30, kind: 'descanso', title: 'Descanso' });

  const habits: Habit[] = [
    { id: 'ex-habito-agua', title: 'Beber água', weekdays: [0, 1, 2, 3, 4, 5, 6], state: 'ativo' },
    { id: 'ex-habito-alongar', title: 'Alongar', weekdays: [0, 2, 4], state: 'ativo' },
  ];

  const sessions: FocusSession[] = [];
  const habitLogs: HabitLog[] = [];
  const restDays: RestDay[] = [];

  for (let w = 0; w < SEMANAS; w++) {
    const monday = addDays(PRIMEIRA_SEGUNDA, w * 7);
    for (let i = 0; i < 7; i++) {
      const date = addDays(monday, i);
      const wd = weekdayOf(date);
      if (wd === 5) {
        restDays.push({ date });
        continue;
      }
      if (wd === 6) continue;
      // Semana 0: terça e quinta sem registro, quarta com descanso (cuidado sem foco).
      if (w === 0 && (wd === 1 || wd === 3)) continue;
      if (w === 0 && wd === 2) {
        restDays.push({ date });
        continue;
      }
      const mk = (id: string, period: 'manha' | 'tarde', startMin: number, planned: number, state: FocusSession['state']) => {
        const startedAt = localToMs(date, startMin);
        const effective = state === 'concluida' ? planned : Math.round(planned * (0.55 + rnd() * 0.3));
        sessions.push({
          id,
          blockId: `ex-bloco-${period}-${wd}`,
          startedAt,
          endedAt: startedAt + effective * 60_000,
          plannedMinutes: planned,
          state,
          pausedMs: 0,
        });
      };
      // O primeiro foco é um longo, para os testes terem a conquista de foco profundo.
      const morningMinutes = w === 0 && wd === 0 ? FOCUS.maxMinutes : BLOCK_MINUTES;
      mk(`ex-sessao-${date}-m`, 'manha', MORNING_START + int(0, 5), morningMinutes, 'concluida');
      // Tarde: na maioria dos dias interrompida (padrão que a IA pode notar).
      const afternoonDone = rnd() < 0.25;
      mk(`ex-sessao-${date}-t`, 'tarde', AFTERNOON_START + int(0, 5), BLOCK_MINUTES, afternoonDone ? 'concluida' : 'interrompida');
      habitLogs.push({ habitId: 'ex-habito-agua', date, doneAt: localToMs(date, 10 * 60) });
      if (wd % 2 === 0) habitLogs.push({ habitId: 'ex-habito-alongar', date, doneAt: localToMs(date, 7 * 60 + 30) });
    }
  }

  // Terça da primeira semana: sem registro, protegida pelo gelo de presente.
  const freezeUses: FreezeUse[] = [{ date: addDays(PRIMEIRA_SEGUNDA, 1), vistoEm: createdAt }];

  return { user, blocks, habits, habitLogs, sessions, restDays, freezeUses };
}

/** Grava as quatro semanas no repositório, apagando o que houver, e o estado do sapo que elas dão. */
export async function gravarQuatroSemanas(repo: Repository, clock: Clock): Promise<void> {
  // A conta de exemplo nasce com os dados, para as métricas terem história.
  const d = gerarQuatroSemanas(SEMENTE, localToMs(PRIMEIRA_SEGUNDA, DEFAULT_DAY_START_HOUR * 60));
  await repo.clearAll();
  await repo.saveUser(d.user);
  for (const b of d.blocks) await repo.saveBlock(b);
  for (const h of d.habits) await repo.saveHabit(h);
  for (const l of d.habitLogs) await repo.saveHabitLog(l);
  for (const s of d.sessions) await repo.saveSession(s);
  for (const r of d.restDays) await repo.saveRestDay(r);
  if (providesFreezeStore(repo)) await repo.saveFreezeUses(d.freezeUses);
  await refreshMascotState(repo, TZ, clock.now());
}
