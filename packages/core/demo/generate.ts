import type {
  FocusSession,
  Habit,
  HabitLog,
  RestDay,
  RoutineBlock,
  User,
  Weekday,
} from '../domain/types';
import { FOCUS } from '../config/decisions';
import { addDays, localToMs, weekdayOf } from './time';

/** Segunda da primeira das 4 semanas sintéticas. A última termina em 22/11/2026. */
export const DEMO_FIRST_MONDAY = '2026-10-26';
export const DEMO_WEEKS = 4;
export const DEMO_DEFAULT_SEED = 20261121;

export interface DemoData {
  user: User;
  blocks: RoutineBlock[];
  habits: Habit[];
  habitLogs: HabitLog[];
  sessions: FocusSession[];
  restDays: RestDay[];
}

/** PRNG determinístico (mulberry32). */
export function createRng(seed: number): () => number {
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
export function generateDemoData(seed: number = DEMO_DEFAULT_SEED, createdAt = 0): DemoData {
  const rnd = createRng(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

  const user: User = {
    id: 'demo-user',
    frogName: 'Sapo de exemplo',
    timezone: 'America/Sao_Paulo',
    dayStartMinutes: 7 * 60,
    dayEndMinutes: 22 * 60,
    theme: 'sistema',
    reduceMotion: false,
    createdAt,
  };

  const blocks: RoutineBlock[] = [];
  for (const wd of WEEKDAYS) {
    blocks.push({ id: `demo-bloco-manha-${wd}`, weekday: wd, startMinutes: MORNING_START, durationMinutes: BLOCK_MINUTES, kind: 'foco', title: 'Foco da manhã' });
    blocks.push({ id: `demo-bloco-tarde-${wd}`, weekday: wd, startMinutes: AFTERNOON_START, durationMinutes: BLOCK_MINUTES, kind: 'foco', title: 'Foco da tarde' });
  }
  blocks.push({ id: 'demo-bloco-descanso-5', weekday: 5, startMinutes: 10 * 60, durationMinutes: 30, kind: 'descanso', title: 'Descanso' });

  const habits: Habit[] = [
    { id: 'demo-habito-agua', title: 'Beber água', weekdays: [0, 1, 2, 3, 4, 5, 6], active: true },
    { id: 'demo-habito-alongar', title: 'Alongar', weekdays: [0, 2, 4], active: true },
  ];

  const sessions: FocusSession[] = [];
  const habitLogs: HabitLog[] = [];
  const restDays: RestDay[] = [];

  for (let w = 0; w < DEMO_WEEKS; w++) {
    const monday = addDays(DEMO_FIRST_MONDAY, w * 7);
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
          blockId: `demo-bloco-${period}-${wd}`,
          startedAt,
          endedAt: startedAt + effective * 60_000,
          plannedMinutes: planned,
          state,
          pausedMs: 0,
        });
      };
      // O primeiro foco é um longo, para o demo mostrar a conquista de foco profundo.
      const morningMinutes = w === 0 && wd === 0 ? FOCUS.maxMinutes : BLOCK_MINUTES;
      mk(`demo-sessao-${date}-m`, 'manha', MORNING_START + int(0, 5), morningMinutes, 'concluida');
      // Tarde: na maioria dos dias interrompida (padrão que a IA pode notar).
      const afternoonDone = rnd() < 0.25;
      mk(`demo-sessao-${date}-t`, 'tarde', AFTERNOON_START + int(0, 5), BLOCK_MINUTES, afternoonDone ? 'concluida' : 'interrompida');
      habitLogs.push({ habitId: 'demo-habito-agua', date, doneAt: localToMs(date, 10 * 60) });
      if (wd % 2 === 0) habitLogs.push({ habitId: 'demo-habito-alongar', date, doneAt: localToMs(date, 7 * 60 + 30) });
    }
  }

  return { user, blocks, habits, habitLogs, sessions, restDays };
}
