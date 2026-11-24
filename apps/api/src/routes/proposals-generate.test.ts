import { generateProposalResponseSchema } from '@pulo/core/api/schemas';
import { proposalLabel } from '@pulo/core/domain/ia/label';
import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { AFTERNOON_BLOCK, MORNING_BLOCK, TITLES, WEEK, seedProposalWeek } from '../proposal-fixtures';
import { TEST_NOW, type TestUser, createHarness, queriesOf } from '../testing';
import { FakeProvider, type ProviderAdapter } from '../weekly-ai';

let database: TestDatabase;
let h: ReturnType<typeof createHarness>;

beforeAll(async () => {
  database = await createTestDatabase();
  h = createHarness(database);
});
afterAll(async () => {
  await database.close();
});

const generate = async (user: TestUser, body?: unknown) => {
  const res = await user.call('POST', '/api/proposals/generate', body);
  return { status: res.status, body: generateProposalResponseSchema.safeParse(await res.clone().json()).data ?? (await res.json()) };
};
const countProposals = (userId: string) => database.db.weeklyProposal.count({ where: { userId } });

async function userWithWeek(harness = h, extra = 0, metadata?: Parameters<typeof h.newUser>[0]) {
  const me = await harness.newUser(metadata);
  await seedProposalWeek(database.db, me.id, extra);
  return me;
}

describe('POST /api/proposals/generate', () => {
  it('exige sessão e Origin (CSRF)', async () => {
    expect((await h.app.request('/api/proposals/generate', { method: 'POST', headers: { origin: 'http://localhost:3000' } })).status).toBe(401);
    const me = await h.newUser();
    const semOrigem = await h.app.request('/api/proposals/generate', { method: 'POST', headers: { cookie: me.cookie } });
    expect(semOrigem.status).toBe(403);
    expect((await semOrigem.json()).error).toBe('origem_ausente');
  });

  it('poucos dados: devolve "conhecendo" e não cria nada nem chama a IA', async () => {
    const provider = new FakeProvider();
    const local = createHarness(database, { provider });
    const me = await local.newUser();
    const res = await generate(me, { date: WEEK });
    expect(res).toEqual({ status: 200, body: { outcome: 'conhecendo' } });
    expect(await countProposals(me.id)).toBe(0);
    expect(provider.prompts).toHaveLength(0);
  });

  it('sem IA no ambiente vale a regra: origem regra, pendente, guardada e rotulada "Sugestão"', async () => {
    const me = await userWithWeek();
    const res = await generate(me, { date: '2026-11-18' });
    expect(res.status).toBe(200);
    if (res.body.outcome !== 'proposta') throw new Error(`esperava proposta: ${JSON.stringify(res.body)}`);
    const { proposal } = res.body;
    expect(proposal).toMatchObject({ weekStart: WEEK, state: 'pendente', origin: 'regra', createdAt: TEST_NOW });
    expect(proposalLabel(proposal.origin)).toBe('Sugestão');
    expect(proposal.changes).toHaveLength(1);
    expect(proposal.changes[0]).toMatchObject({ kind: 'mover_foco', blockId: `${MORNING_BLOCK}-${me.id}`, from: { weekday: 1, startMinutes: 540 } });
    expect((await (await me.call('GET', '/api/proposals')).json()).proposals).toEqual([proposal]);
  });

  it('uma proposta por semana: a segunda chamada devolve a existente (200) sem chamar a IA de novo', async () => {
    const provider = new FakeProvider();
    const local = createHarness(database, { provider });
    const me = await userWithWeek(local);
    const first = await generate(me, { date: WEEK });
    const second = await generate(me, { date: '2026-11-20' });
    expect(first.body.outcome).toBe('proposta');
    expect(second.status).toBe(200);
    expect(second.body.outcome).toBe('existente');
    expect(second.body.proposal.id).toBe(first.body.proposal.id);
    expect(await countProposals(me.id)).toBe(1);
    expect(provider.prompts).toHaveLength(1);
  });

  it('duas gerações ao mesmo tempo terminam com uma só proposta', async () => {
    const me = await userWithWeek();
    const [a, b] = await Promise.all([generate(me, { date: WEEK }), generate(me, { date: WEEK })]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body.proposal.id).toBe(b.body.proposal.id);
    expect(await countProposals(me.id)).toBe(1);
  });

  it('com IA configurada e resposta válida: origem ia, texto do provedor, rótulo "Sugestão da IA"', async () => {
    const local = createHarness(database, { provider: new FakeProvider() });
    const me = await userWithWeek(local);
    const res = await generate(me, { date: WEEK });
    if (res.body.outcome !== 'proposta') throw new Error('sem proposta');
    expect(res.body.proposal.origin).toBe('ia');
    expect(res.body.proposal.patternText).toBe('Alguns períodos renderam menos que outros nesta semana');
    expect(proposalLabel(res.body.proposal.origin)).toBe('Sugestão da IA');
  });

  describe('a IA falha: cai na proposta por regra (origem regra)', () => {
    const cases: [string, ProviderAdapter, number?][] = [
      ['provedor lança erro', { complete: () => Promise.reject(new Error('fora do ar')) }],
      ['saída não é JSON', new FakeProvider(() => 'olá, aqui vai um texto')],
      ['índice de candidata inexistente', new FakeProvider(() => JSON.stringify({ candidata_escolhida: 7, padrao: 'a', motivo: 'b', tom: 'leve' }))],
      ['termo proibido no texto', new FakeProvider(() => JSON.stringify({ candidata_escolhida: 0, padrao: 'Sinal de depressão', motivo: 'b', tom: 'leve' }))],
      ['horário escrito no texto', new FakeProvider(() => JSON.stringify({ candidata_escolhida: 0, padrao: 'Mude para 15:00', motivo: 'b', tom: 'leve' }))],
      ['timeout', { complete: () => new Promise<string>(() => undefined) }, 20],
    ];
    it.each(cases)('%s', async (_name, provider, aiTimeoutMs) => {
      const local = createHarness(database, { provider, ...(aiTimeoutMs ? { aiTimeoutMs } : {}) });
      const me = await userWithWeek(local);
      const res = await generate(me, { date: WEEK });
      expect(res.status).toBe(200);
      if (res.body.outcome !== 'proposta') throw new Error('sem proposta');
      expect(res.body.proposal.origin).toBe('regra');
      expect(proposalLabel(res.body.proposal.origin)).toBe('Sugestão');
      expect(await countProposals(me.id)).toBe(1);
    });
  });

  it('quarentena: bloco de uma proposta negada nas últimas semanas não volta (sem candidata, nada criado)', async () => {
    const me = await userWithWeek();
    const change = {
      kind: 'mover_foco',
      blockId: `${MORNING_BLOCK}-${me.id}`,
      from: { weekday: 1, startMinutes: 540, durationMinutes: 50 },
      to: { weekday: 1, startMinutes: 840, durationMinutes: 50 },
    };
    await database.db.weeklyProposal.create({
      data: {
        userId: me.id,
        weekStart: new Date(Date.UTC(2026, 10, 9)),
        state: 'negada',
        patternText: 'p',
        changes: [change],
        origin: 'regra',
        createdAt: new Date(TEST_NOW - 7 * 86_400_000),
        decidedAt: new Date(TEST_NOW - 7 * 86_400_000),
      },
    });
    expect((await generate(me, { date: WEEK })).body).toEqual({ outcome: 'sem_candidata' });
    expect(await countProposals(me.id)).toBe(1);
    // Passada a quarentena (WEEKLY_AI.deniedCooldownWeeks = 2 semanas), a ideia volta.
    expect((await generate(me, { date: '2026-11-30' })).body.outcome).toBe('conhecendo');
  });

  it('semana padrão: a do relógio do servidor no fuso da pessoa', async () => {
    // Domingo 22/11 23:30 UTC: em São Paulo ainda é a semana de 16/11; em Tóquio já é segunda 23/11.
    h.setNow(Date.UTC(2026, 10, 22, 23, 30));
    try {
      const sp = await h.newUser();
      const tokyo = await h.newUser({ timezone: 'Asia/Tokyo' });
      const base = (userId: string, weekStart: Date) => ({
        userId,
        weekStart,
        state: 'pendente' as const,
        patternText: 'p',
        changes: [],
        origin: 'regra' as const,
        createdAt: new Date(TEST_NOW),
      });
      await database.db.weeklyProposal.createMany({
        data: [base(sp.id, new Date(Date.UTC(2026, 10, 16))), base(tokyo.id, new Date(Date.UTC(2026, 10, 23)))],
      });
      const [a, b] = [await generate(sp), await generate(tokyo)];
      expect(a.body.proposal.weekStart).toBe('2026-11-16');
      expect(b.body.proposal.weekStart).toBe('2026-11-23');
    } finally {
      h.setNow(TEST_NOW);
    }
  });

  it('valida o corpo (data)', async () => {
    const me = await h.newUser();
    for (const body of [{ date: '2026-13-40' }, { date: 20261116 }, { date: 'segunda' }]) {
      const res = await me.call('POST', '/api/proposals/generate', body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect((await res.json()).error).toBe('corpo_invalido');
    }
    expect((await me.call('POST', '/api/proposals/generate')).status).toBe(200);
  });

  it('isolamento: os dados de outra pessoa não entram na proposta', async () => {
    const rich = await userWithWeek();
    const empty = await h.newUser();
    await generate(rich, { date: WEEK });
    expect((await generate(empty, { date: WEEK })).body).toEqual({ outcome: 'conhecendo' });
    expect((await (await empty.call('GET', '/api/proposals')).json()).proposals).toEqual([]);
  });

  it('queries: o número é o mesmo com poucos e com muitos dados (1 e 50)', async () => {
    const small = await userWithWeek(h, 0);
    const big = await userWithWeek(h, 49);
    const smallBlocks = await database.db.routineBlock.count({ where: { userId: small.id } });
    const bigBlocks = await database.db.routineBlock.count({ where: { userId: big.id } });
    expect([smallBlocks, bigBlocks]).toEqual([2, 51]);
    const none = await h.newUser();

    // 2 da sessão + 6 leituras (4 do resumo, blocos, propostas) + 1 INSERT ao criar.
    const body = { date: WEEK };
    const knowing = await queriesOf(database, none, 'POST', '/api/proposals/generate', body);
    const created = await queriesOf(database, small, 'POST', '/api/proposals/generate', body);
    const createdBig = await queriesOf(database, big, 'POST', '/api/proposals/generate', body);
    const existing = await queriesOf(database, small, 'POST', '/api/proposals/generate', body);
    const existingBig = await queriesOf(database, big, 'POST', '/api/proposals/generate', body);
    expect({ knowing, created, createdBig, existing, existingBig }).toEqual({ knowing: 7, created: 8, createdBig: 8, existing: 7, existingBig: 7 });
  });

  describe('privacidade: o que chega ao provedor de IA', () => {
    it('o corpo enviado tem só o resumo agregado e as candidatas, sem títulos, nomes, ids nem texto livre', async () => {
      const provider = new FakeProvider();
      const local = createHarness(database, { provider });
      const me = await userWithWeek(local, 0, {
        profile: { frogName: 'Sapinho Confidencial', dayStartMinutes: 420, dayEndMinutes: 1320, createdAt: 1 },
      });
      const res = await generate(me, { date: WEEK });
      expect(res.body.outcome).toBe('proposta');
      expect(provider.prompts).toHaveLength(1);

      const [{ system, user: payload }] = provider.prompts;
      const sent = JSON.parse(payload) as Record<string, unknown>;
      expect(Object.keys(sent).sort()).toEqual(['candidatas', 'resumo', 'tom']);

      // Nenhum dado da pessoa, nem no corpo nem no prompt de sistema.
      const secrets = [
        ...TITLES, 'Sapinho Confidencial', 'Pessoa Teste', '@example.com', me.id,
        `${MORNING_BLOCK}-${me.id}`, `${AFTERNOON_BLOCK}-${me.id}`, MORNING_BLOCK, AFTERNOON_BLOCK,
        res.body.outcome === 'proposta' ? res.body.proposal.id : '',
      ];
      for (const secret of secrets) {
        expect(payload, secret).not.toContain(secret);
        expect(system, secret).not.toContain(secret);
      }

      // Só estas chaves existem, em qualquer nível (lista de permissão): nada de title, blockId, id, name, email, texto livre.
      const allowed = new Set([
        'resumo', 'candidatas', 'tom', 'weekStart', 'weekEnd', 'focusMinutesByPeriod', 'sessionsByPeriod',
        'manha', 'tarde', 'noite', 'completed', 'interrupted', 'completionRate', 'totalSessions', 'restDays', 'careDays', 'daysWithRecord', 'stable',
        'index', 'kind', 'fromPeriod', 'toPeriod', 'from', 'to', 'weekday', 'startMinutes', 'durationMinutes',
      ]);
      const keys = (value: unknown): string[] =>
        Array.isArray(value) ? value.flatMap(keys) : value && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => [k, ...keys(v)]) : [];
      expect(keys(sent).filter((key) => !allowed.has(key))).toEqual([]);

      // Todo texto é enum ou data; nenhuma string livre.
      const strings = (value: unknown): string[] =>
        typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(strings) : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
      const enums = new Set(['mover_foco', 'encurtar_foco', 'manha', 'tarde', 'noite', 'leve', 'neutro', 'acolhedor']);
      for (const text of strings(sent)) expect(enums.has(text) || /^\d{4}-\d{2}-\d{2}$/.test(text), text).toBe(true);
    });
  });
});
