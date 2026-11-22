import { PERIODS, WEEKLY_AI, FOCUS, BLOCK_MIN_MINUTES } from '../../config/decisions';
import type {
  BlockSlot,
  Period,
  ProposalChange,
  ProposalChangeKind,
  RoutineBlock,
  WeekSummary,
  WeeklyProposal,
} from '../types';
import { AI_GUARDS } from './limits';
import { weeksBetween } from './weeks';

export interface Candidate {
  kind: ProposalChangeKind;
  change: ProposalChange;
  /** Período do bloco de origem. */
  fromPeriod: Period;
  /** Período de destino (igual ao de origem em `encurtar_foco`). */
  toPeriod: Period;
}

const PERIOD_ORDER: Period[] = ['manha', 'tarde', 'noite'];

export function periodOfMinutes(startMinutes: number): Period | null {
  for (const p of PERIOD_ORDER) {
    const { startHour, endHour } = PERIODS[p];
    if (startMinutes >= startHour * 60 && startMinutes < endHour * 60) return p;
  }
  return null;
}

export function slotOverlaps(a: BlockSlot, b: BlockSlot): boolean {
  if (a.weekday !== b.weekday) return false;
  return a.startMinutes < b.startMinutes + b.durationMinutes && b.startMinutes < a.startMinutes + a.durationMinutes;
}

export function blockSlot(b: RoutineBlock): BlockSlot {
  return { weekday: b.weekday, startMinutes: b.startMinutes, durationMinutes: b.durationMinutes };
}

/** Procura um horário livre dentro do período, o mais perto do meio dele. */
function findFreeSlot(
  block: RoutineBlock,
  period: Period,
  blocks: RoutineBlock[],
): BlockSlot | null {
  const { startHour, endHour } = PERIODS[period];
  const lo = startHour * 60;
  const hi = endHour * 60 - block.durationMinutes;
  const mid = (lo + endHour * 60) / 2 - block.durationMinutes / 2;
  let best: BlockSlot | null = null;
  for (let start = lo; start <= hi; start += AI_GUARDS.slotStepMinutes) {
    const slot: BlockSlot = { weekday: block.weekday, startMinutes: start, durationMinutes: block.durationMinutes };
    const busy = blocks.some((o) => o.id !== block.id && slotOverlaps(slot, blockSlot(o)));
    if (busy) continue;
    if (!best || Math.abs(start - mid) < Math.abs(best.startMinutes - mid)) best = slot;
  }
  return best;
}

function moveCandidates(summary: WeekSummary, blocks: RoutineBlock[]): Candidate[] {
  const counted = PERIOD_ORDER.filter(
    (p) =>
      summary.energyByPeriod[p].checkIns >= WEEKLY_AI.minCheckInsPerPeriodToCount &&
      summary.energyByPeriod[p].average !== null &&
      summary.sessionsByPeriod[p].completionRate !== null,
  );
  // Período forte: maior energia média entre os que contam.
  const strong = [...counted].sort(
    (a, b) => (summary.energyByPeriod[b].average ?? 0) - (summary.energyByPeriod[a].average ?? 0),
  )[0];
  if (!strong) return [];
  const sE = summary.energyByPeriod[strong].average as number;
  const sR = summary.sessionsByPeriod[strong].completionRate as number;
  const out: Candidate[] = [];
  for (const weak of counted) {
    if (weak === strong) continue;
    const wE = summary.energyByPeriod[weak].average as number;
    const wR = summary.sessionsByPeriod[weak].completionRate as number;
    if (!(wE < sE && wR < sR)) continue;
    const focus = blocks
      .filter((b) => b.kind === 'foco' && periodOfMinutes(b.startMinutes) === weak)
      .sort((a, b) => a.weekday - b.weekday || a.startMinutes - b.startMinutes);
    for (const block of focus) {
      const to = findFreeSlot(block, strong, blocks);
      if (!to) continue;
      out.push({
        kind: 'mover_foco',
        fromPeriod: weak,
        toPeriod: strong,
        change: { kind: 'mover_foco', blockId: block.id, from: blockSlot(block), to },
      });
    }
  }
  return out;
}

function shortenCandidates(summary: WeekSummary, blocks: RoutineBlock[], exclude: Set<string>): Candidate[] {
  const out: Candidate[] = [];
  for (const p of PERIOD_ORDER) {
    const interrupted = summary.sessionsByPeriod[p].interrupted;
    if (interrupted <= WEEKLY_AI.maxInterruptionsBeforeShorten) continue;
    const options = WEEKLY_AI.shortenByMinutesOptions;
    const excess = interrupted - WEEKLY_AI.maxInterruptionsBeforeShorten;
    const by = options[Math.min(excess, options.length) - 1];
    const block = blocks
      .filter((b) => b.kind === 'foco' && !exclude.has(b.id) && periodOfMinutes(b.startMinutes) === p)
      .sort((a, b) => b.durationMinutes - a.durationMinutes || a.weekday - b.weekday)[0];
    if (!block) continue;
    const newDuration = block.durationMinutes - by;
    if (newDuration < Math.max(FOCUS.minMinutes, BLOCK_MIN_MINUTES)) continue;
    out.push({
      kind: 'encurtar_foco',
      fromPeriod: p,
      toPeriod: p,
      change: {
        kind: 'encurtar_foco',
        blockId: block.id,
        from: blockSlot(block),
        to: { ...blockSlot(block), durationMinutes: newDuration },
      },
    });
  }
  return out;
}

export function candidateKey(c: { kind: ProposalChangeKind; blockId: string }): string {
  return `${c.kind}:${c.blockId}`;
}

/** Chaves (tipo e bloco) negadas nas últimas semanas e ainda em quarentena. */
export function cooledDownKeys(proposals: WeeklyProposal[], currentWeekStart: string): Set<string> {
  const keys = new Set<string>();
  for (const p of proposals) {
    if (p.state !== 'negada') continue;
    const diff = weeksBetween(p.weekStart, currentWeekStart);
    if (diff > 0 && diff <= WEEKLY_AI.deniedCooldownWeeks) {
      for (const c of p.changes) keys.add(candidateKey(c));
    }
  }
  return keys;
}

/**
 * Candidatas por regra, já válidas: nunca sobrepõem outro bloco, nunca repetem
 * um bloco e deixam de fora o que foi negado há pouco. No máximo AI_GUARDS.maxCandidates.
 */
export function computeCandidates(
  summary: WeekSummary,
  blocks: RoutineBlock[],
  proposals: WeeklyProposal[] = [],
): Candidate[] {
  const blocked = cooledDownKeys(proposals, summary.weekStart);
  const moves = moveCandidates(summary, blocks)
    .filter((c) => !blocked.has(candidateKey(c.change)))
    .slice(0, AI_GUARDS.maxCandidatesPerKind);
  const used = new Set(moves.map((c) => c.change.blockId));
  const all = [
    ...moves,
    ...shortenCandidates(summary, blocks, used)
      .filter((c) => !blocked.has(candidateKey(c.change)))
      .slice(0, AI_GUARDS.maxCandidatesPerKind),
  ];
  const seenBlocks = new Set<string>();
  const out: Candidate[] = [];
  for (const c of all) {
    if (blocked.has(candidateKey(c.change))) continue;
    if (seenBlocks.has(c.change.blockId)) continue;
    seenBlocks.add(c.change.blockId);
    out.push(c);
  }
  return out.slice(0, AI_GUARDS.maxCandidates);
}

export function hasEnoughData(summary: WeekSummary): boolean {
  return (
    summary.daysWithRecord >= WEEKLY_AI.minDaysWithRecord &&
    summary.totalSessions + summary.totalCheckIns >= WEEKLY_AI.minSessionsOrCheckIns
  );
}
