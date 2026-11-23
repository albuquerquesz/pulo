import { WEEKLY_AI } from '../../config/decisions';
import type { RoutineBlock, WeekSummary, WeeklyProposal } from '../types';
import {
  FakeWeeklyAiClient,
  acceptProposal,
  buildAiRequest,
  computeCandidates,
  createHttpWeeklyAiClient,
  denyProposal,
  editProposal,
  findForbiddenTerms,
  generateWeeklyProposal,
  proposalLabel,
  ruleTexts,
  undoDecision,
  validateAiOutput,
} from './index';

const stats = (completed: number, interrupted: number) => ({
  completed,
  interrupted,
  completionRate: completed + interrupted ? completed / (completed + interrupted) : null,
});

function summary(over: Partial<WeekSummary> = {}): WeekSummary {
  return {
    weekStart: '2026-11-16',
    weekEnd: '2026-11-22',
    focusMinutesByPeriod: { manha: 100, tarde: 25, noite: 0 },
    sessionsByPeriod: { manha: stats(4, 0), tarde: stats(1, 2), noite: stats(0, 0) },
    totalSessions: 7,
    restDays: 1,
    careDays: 5,
    daysWithRecord: 5,
    stable: true,
    ...over,
  };
}

const block = (id: string, weekday: 0 | 1 | 2, start: number, dur = 25): RoutineBlock => ({
  id,
  weekday,
  startMinutes: start,
  durationMinutes: dur,
  kind: 'foco',
  title: 'Título secreto',
});
const blocks = [block('a', 0, 14 * 60 + 30), block('m', 0, 9 * 60)];
let n = 0;
const newId = () => `p${++n}`;
const good = { candidata_escolhida: 0, padrao: 'A tarde rendeu menos', motivo: 'De manhã seus focos rendem mais', tom: 'leve' };

describe('candidatas', () => {
  it('gera mover foco da tarde para a manhã sem sobrepor', () => {
    const c = computeCandidates(summary(), blocks);
    expect(c[0].kind).toBe('mover_foco');
    expect(c[0].change.blockId).toBe('a');
    expect(c[0].fromPeriod).toBe('tarde');
    expect(c[0].toPeriod).toBe('manha');
    const to = c[0].change.to;
    expect(to.startMinutes >= 5 * 60 && to.startMinutes + to.durationMinutes <= 12 * 60).toBe(true);
    expect(to.startMinutes >= 9 * 60 + 25 || to.startMinutes + to.durationMinutes <= 9 * 60).toBe(true);
  });

  it('nunca gera horário ocupado: manhã toda tomada, sem candidata de mover', () => {
    const full = [block('a', 0, 14 * 60), { ...block('f', 0, 5 * 60, 120), id: 'f1' }, { ...block('g', 0, 7 * 60, 120), id: 'f2' }, { ...block('h', 0, 9 * 60, 120), id: 'f3' }, { ...block('i', 0, 11 * 60, 60), id: 'f4' }];
    expect(computeCandidates(summary(), full).filter((c) => c.kind === 'mover_foco')).toHaveLength(0);
  });

  it('exige sessões mínimas no período', () => {
    const s = summary({ sessionsByPeriod: { manha: stats(4, 0), tarde: stats(0, WEEKLY_AI.minSessionsPerPeriodToCount - 1), noite: stats(0, 0) } });
    expect(computeCandidates(s, blocks)).toHaveLength(0);
  });

  it('encurta foco com interrupções acima do limite, respeitando mínimo', () => {
    const s = summary({
      // manhã abaixo do mínimo: não entra na comparação, então só sobra encurtar
      sessionsByPeriod: { manha: stats(WEEKLY_AI.minSessionsPerPeriodToCount - 1, 0), tarde: stats(0, WEEKLY_AI.maxInterruptionsBeforeShorten + 1), noite: stats(0, 0) },
    });
    const c = computeCandidates(s, blocks);
    expect(c).toHaveLength(1);
    expect(c[0].kind).toBe('encurtar_foco');
    expect(c[0].change.to.durationMinutes).toBe(25 - WEEKLY_AI.shortenByMinutesOptions[0]);
    expect(computeCandidates(s, [block('a', 0, 14 * 60, 18)])).toHaveLength(0);
  });

  it('nunca repete bloco e respeita o máximo', () => {
    const many = [0, 1, 2].map((d, i) => block(`t${i}`, d as 0 | 1 | 2, 14 * 60));
    const s = summary({ sessionsByPeriod: { manha: stats(4, 0), tarde: stats(0, 5), noite: stats(0, 0) } });
    const c = computeCandidates(s, many);
    expect(c.length).toBeLessThanOrEqual(3);
    expect(new Set(c.map((x) => x.change.blockId)).size).toBe(c.length);
  });

  it('proposta tem no máximo maxChangesPerProposal mudanças', async () => {
    const r = await generateWeeklyProposal({ summary: summary(), blocks, proposals: [], now: 1, newId });
    if (r.kind !== 'proposta') throw new Error('esperava proposta');
    expect(r.proposal.changes.length).toBeLessThanOrEqual(WEEKLY_AI.maxChangesPerProposal);
  });
});

describe('validação e termos proibidos', () => {
  it('aceita saída válida (objeto ou JSON)', () => {
    expect(validateAiOutput(good, 1).ok).toBe(true);
    expect(validateAiOutput(JSON.stringify(good), 1).ok).toBe(true);
  });
  it.each([
    ['json quebrado', '{oops'],
    ['índice fora', { ...good, candidata_escolhida: 3 }],
    ['índice negativo', { ...good, candidata_escolhida: -1 }],
    ['índice não inteiro', { ...good, candidata_escolhida: 0.5 }],
    ['sem motivo', { ...good, motivo: undefined }],
    ['tom ruim', { ...good, tom: 'agressivo' }],
    ['texto grande', { ...good, padrao: 'x'.repeat(500) }],
    ['horário no texto', { ...good, motivo: 'Mova para 9h30' }],
    ['array', []],
    ['null', null],
  ])('descarta %s', (_n, raw) => {
    expect(validateAiOutput(raw, 1).ok).toBe(false);
  });
  it.each(['Isso parece depressão', 'Sua ANSIEDADE aumentou', 'Considere um tratamento', 'Foi por preguiça', 'A culpa é sua', 'Você precisa de medicamento', 'diagnóstico'])(
    'detecta termo proibido em "%s"',
    (t) => {
      expect(findForbiddenTerms(t).length).toBeGreaterThan(0);
      expect(validateAiOutput({ ...good, padrao: t }, 1).ok).toBe(false);
    },
  );
  it('não bloqueia texto normal nem falsos positivos óbvios', () => {
    expect(findForbiddenTerms('As tardes renderam menos; que tal manhãs?')).toHaveLength(0);
    expect(findForbiddenTerms('Você acurou o foco')).toHaveLength(0);
  });
  it('os textos da regra passam nas guardas', () => {
    for (const c of computeCandidates(summary(), blocks)) {
      const t = ruleTexts(c);
      expect(validateAiOutput({ candidata_escolhida: 0, padrao: t.patternText, motivo: t.reasonText, tom: 'leve' }, 1).ok).toBe(true);
    }
  });
});

describe('fluxo, reserva e rótulos', () => {
  it('IA válida gera origem ia com horário da candidata', async () => {
    const client = new FakeWeeklyAiClient(() => good);
    const r = await generateWeeklyProposal({ summary: summary(), blocks, proposals: [], client, now: 1, newId });
    if (r.kind !== 'proposta') throw new Error();
    expect(r.proposal.origin).toBe('ia');
    expect(r.proposal.patternText).toBe(good.padrao);
    expect(r.proposal.changes[0].to).toEqual(computeCandidates(summary(), blocks)[0].change.to);
    expect(proposalLabel(r.proposal.origin)).toBe('Sugestão da IA');
  });

  it.each([
    ['erro', () => Promise.reject(new Error('rede'))],
    ['json quebrado', () => '{x'],
    ['índice inválido', () => ({ ...good, candidata_escolhida: 9 })],
    ['termo proibido', () => ({ ...good, motivo: 'por causa da depressão' })],
  ])('cai na regra com rótulo Sugestão: %s', async (_n, behavior) => {
    const client = new FakeWeeklyAiClient(behavior);
    const r = await generateWeeklyProposal({ summary: summary(), blocks, proposals: [], client, now: 1, newId });
    if (r.kind !== 'proposta') throw new Error();
    expect(r.proposal.origin).toBe('regra');
    expect(r.fallbackReason).toBeTruthy();
    expect(proposalLabel(r.proposal.origin)).toBe('Sugestão');
  });

  it('timeout cai na regra e aborta a chamada', async () => {
    let aborted = false;
    const client = new FakeWeeklyAiClient(
      (_r, signal) =>
        new Promise(() => {
          signal?.addEventListener('abort', () => (aborted = true));
        }),
    );
    const r = await generateWeeklyProposal({ summary: summary(), blocks, proposals: [], client, now: 1, newId, timeoutMs: 20 });
    if (r.kind !== 'proposta') throw new Error();
    expect(r.proposal.origin).toBe('regra');
    expect(r.fallbackReason).toBe('timeout');
    expect(aborted).toBe(true);
  });

  it('sem cliente vale a regra', async () => {
    const r = await generateWeeklyProposal({ summary: summary(), blocks, proposals: [], now: 1, newId });
    if (r.kind !== 'proposta') throw new Error();
    expect(r.proposal.origin).toBe('regra');
  });

  it('poucos dados: conhecendo, sem chamar a IA', async () => {
    const client = new FakeWeeklyAiClient(() => good);
    for (const s of [summary({ daysWithRecord: 2 }), summary({ totalSessions: 2 })]) {
      const r = await generateWeeklyProposal({ summary: s, blocks, proposals: [], client, now: 1, newId });
      expect(r.kind).toBe('conhecendo');
    }
    expect(client.calls).toHaveLength(0);
  });

  it('uma proposta por semana', async () => {
    const existing: WeeklyProposal = { id: 'x', weekStart: '2026-11-16', state: 'pendente', patternText: 'p', changes: [], origin: 'regra', createdAt: 0 };
    const r = await generateWeeklyProposal({ summary: summary(), blocks, proposals: [existing], now: 1, newId });
    expect(r).toEqual({ kind: 'existente', proposal: existing });
  });

  it('o corpo para a IA não tem títulos, nomes nem texto livre', async () => {
    const client = new FakeWeeklyAiClient(() => good);
    await generateWeeklyProposal({ summary: summary(), blocks, proposals: [], client, now: 1, newId });
    const json = JSON.stringify(client.calls[0]);
    expect(json).not.toMatch(/Título secreto|"title"|frogName|"blockId"|"a"/);
    const walk = (v: unknown): void => {
      if (typeof v === 'string') expect(v).toMatch(/^(\d{4}-\d{2}-\d{2}|manha|tarde|noite|mover_foco|encurtar_foco|leve|neutro|acolhedor)$/);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(client.calls[0]);
  });

  it('buildAiRequest descarta campos extras', () => {
    const dirty = { ...summary(), nota: 'texto livre' } as WeekSummary;
    expect(JSON.stringify(buildAiRequest(dirty, []))).not.toContain('texto livre');
  });
});

describe('quarentena de negadas', () => {
  const denied = (weekStart: string): WeeklyProposal => ({
    id: 'd',
    weekStart,
    state: 'negada',
    patternText: 'p',
    changes: computeCandidates(summary(), blocks).slice(0, 1).map((c) => c.change),
    origin: 'regra',
    createdAt: 0,
  });
  it('não volta por deniedCooldownWeeks e volta depois', () => {
    const s1 = summary({ weekStart: '2026-11-23', weekEnd: '2026-11-29' });
    const s2 = summary({ weekStart: '2026-11-30', weekEnd: '2026-12-06' });
    const s3 = summary({ weekStart: '2026-12-07', weekEnd: '2026-12-13' });
    const p = [denied('2026-11-16')];
    expect(WEEKLY_AI.deniedCooldownWeeks).toBe(2);
    expect(computeCandidates(s1, blocks, p).some((c) => c.change.blockId === 'a')).toBe(false);
    expect(computeCandidates(s2, blocks, p).some((c) => c.change.blockId === 'a')).toBe(false);
    expect(computeCandidates(s3, blocks, p).some((c) => c.change.blockId === 'a')).toBe(true);
  });
});

describe('aprovação', () => {
  const pending = async () => {
    const r = await generateWeeklyProposal({ summary: summary(), blocks, proposals: [], now: 1000, newId });
    if (r.kind !== 'proposta') throw new Error();
    return r.proposal;
  };
  it('aceitar altera o bloco e desfazer restaura', async () => {
    const p = await pending();
    const r = acceptProposal(p, blocks, 1000);
    if (!r.ok) throw new Error(r.reason);
    expect(r.blocks.find((b) => b.id === 'a')?.startMinutes).toBe(p.changes[0].to.startMinutes);
    expect(r.proposal.state).toBe('aceita');
    expect(blocks[0].startMinutes).toBe(14 * 60 + 30);
    const u = undoDecision(r.undo, 1000 + WEEKLY_AI.undoSeconds * 1000);
    expect(u?.blocks).toEqual(blocks);
    expect(u?.proposal.state).toBe('pendente');
    expect(undoDecision(r.undo, 1000 + WEEKLY_AI.undoSeconds * 1000 + 1)).toBeNull();
  });
  it('editar valida conflito e duração', async () => {
    const p = await pending();
    const to = p.changes[0].to;
    expect(editProposal(p, blocks, 0, { ...to, startMinutes: 9 * 60 + 10 }, 1).ok).toBe(false);
    expect(editProposal(p, blocks, 0, { ...to, durationMinutes: 3 }, 1).ok).toBe(false);
    const ok = editProposal(p, blocks, 0, { ...to, startMinutes: 10 * 60 + 30 }, 1);
    expect(ok.ok && ok.proposal.state).toBe('editada');
  });
  it('negar não altera blocos e não decide duas vezes', async () => {
    const p = await pending();
    const d = denyProposal(p, 5);
    expect(d.state).toBe('negada');
    expect(acceptProposal(d, blocks, 6)).toEqual({ ok: false, reason: 'ja_decidida' });
  });
});

describe('cliente HTTP', () => {
  it('envia POST ao endpoint sem chave e falha em status de erro', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const ok = createHttpWeeklyAiClient({
      endpoint: 'https://exemplo.invalid/api/weekly-ai',
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return { ok: true, json: async () => good };
      }) as unknown as typeof fetch,
    });
    expect(await ok.suggest(buildAiRequest(summary(), computeCandidates(summary(), blocks)))).toEqual(good);
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.stringify(calls[0].init.headers)).not.toMatch(/authorization|key/i);
    const bad = createHttpWeeklyAiClient({ endpoint: 'x', fetchImpl: (async () => ({ ok: false, status: 500 })) as unknown as typeof fetch });
    await expect(bad.suggest(buildAiRequest(summary(), []))).rejects.toThrow('ia_http_500');
  });
});
