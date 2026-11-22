import { WEEKLY_AI } from '../../config/decisions';
import type { Period, RoutineBlock, WeekSummary, WeeklyProposal } from '../types';
import { computeCandidates, hasEnoughData, type Candidate } from './candidates';
import type { WeeklyAiClient } from './client';
import { DEFAULT_TONE, type AiTone } from './limits';
import { buildAiRequest } from './request';
import { validateAiOutput } from './validate';

const PERIOD_TEXT: Record<Period, string> = {
  manha: 'de manhã',
  tarde: 'à tarde',
  noite: 'à noite',
};

/** Texto da proposta por regra (também passa pelas guardas nos testes). */
export function ruleTexts(c: Candidate): { patternText: string; reasonText: string } {
  if (c.kind === 'mover_foco') {
    return {
      patternText: `Sua energia e seu foco foram menores ${PERIOD_TEXT[c.fromPeriod]} do que ${PERIOD_TEXT[c.toPeriod]}`,
      reasonText: `Um foco ${PERIOD_TEXT[c.toPeriod]} pode render mais`,
    };
  }
  return {
    patternText: `Os focos ${PERIOD_TEXT[c.fromPeriod]} foram interrompidos algumas vezes`,
    reasonText: 'Um foco um pouco mais curto pode ser mais fácil de terminar',
  };
}

export type ProposalOutcome =
  | { kind: 'conhecendo' }
  | { kind: 'existente'; proposal: WeeklyProposal }
  | { kind: 'sem_candidata' }
  | {
      kind: 'proposta';
      proposal: WeeklyProposal;
      /** Se a IA falhou, o motivo (para log e testes). Ausente quando a IA foi usada. */
      fallbackReason?: string;
    };

export interface GenerateInput {
  summary: WeekSummary;
  blocks: RoutineBlock[];
  /** Propostas já guardadas (para uma por semana e quarentena de negadas). */
  proposals: WeeklyProposal[];
  /** Sem cliente, vale só a regra. */
  client?: WeeklyAiClient | null;
  now: number;
  newId: () => string;
  tone?: AiTone;
  timeoutMs?: number;
}

async function askAi(
  client: WeeklyAiClient,
  summary: WeekSummary,
  candidates: Candidate[],
  tone: AiTone,
  timeoutMs: number,
) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('timeout'));
    }, timeoutMs);
  });
  try {
    const raw = await Promise.race([
      client.suggest(buildAiRequest(summary, candidates, tone), { signal: controller.signal }),
      timeout,
    ]);
    const v = validateAiOutput(raw, candidates.length);
    return v.ok ? { ok: true as const, value: v.value } : { ok: false as const, reason: v.reason };
  } catch (e) {
    return { ok: false as const, reason: e instanceof Error ? e.message : 'erro' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pipeline da spec 08: dados mínimos, uma proposta por semana, candidatas por regra,
 * IA opcional e reserva por regra. Nunca lança por falha da IA.
 */
export async function generateWeeklyProposal(input: GenerateInput): Promise<ProposalOutcome> {
  const { summary, blocks, proposals, client, now, newId } = input;
  const existing = proposals.find((p) => p.weekStart === summary.weekStart);
  if (existing) return { kind: 'existente', proposal: existing };
  if (!hasEnoughData(summary)) return { kind: 'conhecendo' };

  const candidates = computeCandidates(summary, blocks, proposals);
  if (candidates.length === 0) return { kind: 'sem_candidata' };

  const base = { id: newId(), weekStart: summary.weekStart, state: 'pendente' as const, createdAt: now };
  const max = WEEKLY_AI.maxChangesPerProposal;

  let fallbackReason: string | undefined;
  if (client) {
    const res = await askAi(
      client,
      summary,
      candidates,
      input.tone ?? DEFAULT_TONE,
      input.timeoutMs ?? WEEKLY_AI.timeoutMs,
    );
    if (res.ok) {
      const chosen = candidates[res.value.candidata_escolhida];
      return {
        kind: 'proposta',
        proposal: {
          ...base,
          patternText: res.value.padrao,
          reasonText: res.value.motivo,
          changes: [chosen.change].slice(0, max),
          origin: 'ia',
        },
      };
    }
    fallbackReason = res.reason;
  }

  const chosen = candidates[0];
  const t = ruleTexts(chosen);
  return {
    kind: 'proposta',
    fallbackReason,
    proposal: {
      ...base,
      patternText: t.patternText,
      reasonText: t.reasonText,
      changes: [chosen.change].slice(0, max),
      origin: 'regra',
    },
  };
}
