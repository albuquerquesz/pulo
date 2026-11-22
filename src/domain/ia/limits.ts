/**
 * Limites técnicos das guardas da IA (tamanho de texto, grade de horários).
 * Não são decisões de produto do Victor; as decisões ficam em src/config/decisions.ts.
 */
export const AI_GUARDS = {
  maxPatternChars: 120,
  maxReasonChars: 140,
  /** Passo da grade de horários livres ao mover um bloco, em minutos. */
  slotStepMinutes: 30,
  /** Máximo de candidatas devolvidas pelo analisador. */
  maxCandidates: 3,
  maxCandidatesPerKind: 2,
} as const;

export const AI_TONES = ['leve', 'neutro', 'acolhedor'] as const;
export type AiTone = (typeof AI_TONES)[number];
export const DEFAULT_TONE: AiTone = 'leve';
