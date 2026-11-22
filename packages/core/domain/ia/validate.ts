import { AI_GUARDS, AI_TONES, type AiTone } from './limits';
import { containsForbiddenTerm } from './forbidden';

export interface AiOutput {
  candidata_escolhida: number;
  padrao: string;
  motivo: string;
  tom: AiTone;
}

export type ValidationResult =
  | { ok: true; value: AiOutput }
  | { ok: false; reason: string };

const TIME_LIKE = /\d{1,2}\s*(h|:)\s*\d{0,2}|\d{1,2}\s*min/i;

/**
 * Valida a resposta da IA (objeto ou string JSON). Descarta índice inválido,
 * campos extras faltando, texto grande, termo proibido e horários escritos nos textos.
 */
export function validateAiOutput(raw: unknown, candidateCount: number): ValidationResult {
  let data: unknown = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return { ok: false, reason: 'json_invalido' };
    }
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, reason: 'formato' };
  }
  const o = data as Record<string, unknown>;
  const idx = o.candidata_escolhida;
  if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= candidateCount) {
    return { ok: false, reason: 'indice_invalido' };
  }
  const { padrao, motivo, tom } = o;
  if (typeof padrao !== 'string' || typeof motivo !== 'string') return { ok: false, reason: 'texto_ausente' };
  const p = padrao.trim();
  const m = motivo.trim();
  if (!p || !m) return { ok: false, reason: 'texto_vazio' };
  if (p.length > AI_GUARDS.maxPatternChars || m.length > AI_GUARDS.maxReasonChars) {
    return { ok: false, reason: 'texto_longo' };
  }
  if (typeof tom !== 'string' || !(AI_TONES as readonly string[]).includes(tom)) {
    return { ok: false, reason: 'tom_invalido' };
  }
  if (containsForbiddenTerm(p) || containsForbiddenTerm(m)) return { ok: false, reason: 'termo_proibido' };
  if (TIME_LIKE.test(p) || TIME_LIKE.test(m)) return { ok: false, reason: 'horario_no_texto' };
  return { ok: true, value: { candidata_escolhida: idx, padrao: p, motivo: m, tom: tom as AiTone } };
}
