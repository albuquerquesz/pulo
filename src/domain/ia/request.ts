import type { BlockSlot, Period, ProposalChangeKind, WeekSummary } from '@/domain/types';
import type { Candidate } from './candidates';
import { DEFAULT_TONE, type AiTone } from './limits';

/** Candidata como a IA a vê: sem id de bloco, sem título. */
export interface AiCandidate {
  index: number;
  kind: ProposalChangeKind;
  fromPeriod: Period;
  toPeriod: Period;
  from: BlockSlot;
  to: BlockSlot;
}

/** Corpo enviado à função de servidor. Só números, enums e datas. */
export interface WeeklyAiRequest {
  summary: WeekSummary;
  candidates: AiCandidate[];
  tone: AiTone;
}

const PERIODS_LIST: Period[] = ['manha', 'tarde', 'noite'];

function pickSlot(s: BlockSlot): BlockSlot {
  return { weekday: s.weekday, startMinutes: s.startMinutes, durationMinutes: s.durationMinutes };
}

/** Monta o corpo copiando campo a campo (lista de permissão), para nada extra vazar. */
export function buildAiRequest(
  summary: WeekSummary,
  candidates: Candidate[],
  tone: AiTone = DEFAULT_TONE,
): WeeklyAiRequest {
  const rec = <T,>(f: (p: Period) => T): Record<Period, T> => ({
    manha: f('manha'),
    tarde: f('tarde'),
    noite: f('noite'),
  });
  return {
    summary: {
      weekStart: summary.weekStart,
      weekEnd: summary.weekEnd,
      focusMinutesByPeriod: rec((p) => summary.focusMinutesByPeriod[p]),
      sessionsByPeriod: rec((p) => ({
        completed: summary.sessionsByPeriod[p].completed,
        interrupted: summary.sessionsByPeriod[p].interrupted,
        completionRate: summary.sessionsByPeriod[p].completionRate,
      })),
      energyByPeriod: rec((p) => ({
        average: summary.energyByPeriod[p].average,
        checkIns: summary.energyByPeriod[p].checkIns,
      })),
      totalCheckIns: summary.totalCheckIns,
      totalSessions: summary.totalSessions,
      restDays: summary.restDays,
      careDays: summary.careDays,
      daysWithRecord: summary.daysWithRecord,
      stable: summary.stable,
    },
    candidates: candidates.map((c, index) => ({
      index,
      kind: c.kind,
      fromPeriod: c.fromPeriod,
      toPeriod: c.toPeriod,
      from: pickSlot(c.change.from),
      to: pickSlot(c.change.to),
    })),
    tone,
  };
}
