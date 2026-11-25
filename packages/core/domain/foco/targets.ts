import { MINUTE_MS } from '../clock';
import { focusedMs } from '../joias';
import type { FocusSession, FocusTarget, TargetFocus } from '../types';

/** O vínculo opcional de uma sessão (spec 19): no máximo um dos três. */
export type FocusLink = Pick<FocusSession, 'habitId' | 'goalId' | 'taskId'>;

export const LINK_KEYS = ['habitId', 'goalId', 'taskId'] as const;
export type LinkKey = (typeof LINK_KEYS)[number];

const TARGET_TYPE = { habitId: 'habito', goalId: 'meta', taskId: 'tarefa' } as const satisfies Record<LinkKey, FocusTarget['tipo']>;

export function linkCount(value: Partial<Record<LinkKey, string | null>>): number {
  return LINK_KEYS.filter((key) => typeof value[key] === 'string').length;
}

/** Só as chaves do vínculo que têm valor. */
export function linkOf(value: FocusLink): FocusLink {
  const link: FocusLink = {};
  for (const key of LINK_KEYS) if (value[key] !== undefined) link[key] = value[key];
  return link;
}

export function targetOf(session: FocusLink): FocusTarget | null {
  for (const key of LINK_KEYS) {
    const id = session[key];
    if (id !== undefined) return { tipo: TARGET_TYPE[key], id };
  }
  return null;
}

/**
 * Minutos de foco por alvo (sem pausas, até o planejado), do maior para o menor; as sessões sem vínculo vêm juntas em
 * `alvo: null`. Alvo com menos de um minuto não aparece.
 */
export function focusByTarget(sessions: readonly FocusSession[]): TargetFocus[] {
  const totals = new Map<string, { alvo: FocusTarget | null; ms: number }>();
  for (const session of sessions) {
    const alvo = targetOf(session);
    const key = alvo ? `${alvo.tipo}:${alvo.id}` : '';
    const total = totals.get(key) ?? { alvo, ms: 0 };
    total.ms += focusedMs(session);
    totals.set(key, total);
  }
  return [...totals.entries()]
    .map(([key, { alvo, ms }]) => ({ key, alvo, minutos: Math.round(ms / MINUTE_MS) }))
    .filter((item) => item.minutos > 0)
    .sort((a, b) => b.minutos - a.minutos || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ alvo, minutos }) => ({ alvo, minutos }));
}
