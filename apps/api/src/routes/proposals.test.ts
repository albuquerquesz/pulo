import { WEEKLY_AI } from '@pulo/core/config/decisions';
import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { type TestUser, TEST_NOW, createHarness, queriesOf } from '../testing';

let database: TestDatabase;
let h: ReturnType<typeof createHarness>;

beforeAll(async () => {
  database = await createTestDatabase();
  h = createHarness(database);
});
afterAll(async () => {
  await database.close();
});

const uuid = () => crypto.randomUUID();
const slot = (startMinutes: number) => ({ weekday: 1, startMinutes, durationMinutes: 50 });
const proposal = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  weekStart: '2026-11-23',
  state: 'pendente',
  patternText: 'Seus focos da manhã foram interrompidos algumas vezes',
  reasonText: 'Talvez a tarde caiba melhor',
  changes: [{ kind: 'mover_foco', blockId: 'bloco-1', from: slot(540), to: slot(840) }],
  origin: 'regra',
  createdAt: TEST_NOW - 1000,
  ...extra,
});
const put = (user: TestUser, body: Record<string, unknown> & { id: string }) => user.call('PUT', `/api/proposals/${body.id}`, body);
const decided = (id: string, state: string, decidedAt = TEST_NOW, extra: Record<string, unknown> = {}) =>
  proposal(id, { state, decidedAt, ...extra });
const seed = (user: TestUser, id: string) =>
  database.db.weeklyProposal.create({
    data: {
      id,
      userId: user.id,
      weekStart: new Date('2026-11-23'),
      state: 'pendente',
      patternText: proposal(id).patternText,
      reasonText: proposal(id).reasonText,
      changes: proposal(id).changes,
      origin: 'regra',
      createdAt: new Date(TEST_NOW - 1000),
    },
  });
const listOf = async (user: TestUser) => (await (await user.call('GET', '/api/proposals')).json()).proposals;

describe('/api/proposals', () => {
  it('exige sessão', async () => {
    expect((await h.app.request('/api/proposals')).status).toBe(401);
    expect((await h.app.request(`/api/proposals/${uuid()}`, { method: 'PUT' })).status).toBe(401);
  });

  it('não cria pelo PUT: ninguém forja uma proposta da IA', async () => {
    const me = await h.newUser();
    const res = await put(me, proposal(uuid(), { origin: 'ia' }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('nao_encontrado');
    expect(await listOf(me)).toEqual([]);
  });

  it('só expira uma pendente; repetir o gravado é idempotente', async () => {
    const me = await h.newUser();
    const id = uuid();
    await seed(me, id);
    expect((await put(me, proposal(id))).status).toBe(200);
    const bad = [
      decided(id, 'aceita'),
      decided(id, 'editada'),
      decided(id, 'negada'),
      decided(id, 'expirada', TEST_NOW, { origin: 'ia' }),
      decided(id, 'expirada', TEST_NOW, { patternText: 'outro texto' }),
      proposal(id, { createdAt: TEST_NOW - 5 }),
    ];
    for (const body of bad) {
      const res = await put(me, body);
      expect(res.status, JSON.stringify(body)).toBe(409);
      expect((await res.json()).error).toBe('proposta_transicao_invalida');
    }
    const expired = await put(me, decided(id, 'expirada'));
    expect(expired.status).toBe(200);
    expect(await expired.json()).toEqual({ proposal: decided(id, 'expirada') });
    expect((await put(me, decided(id, 'expirada'))).status).toBe(200);
    expect((await put(me, proposal(id))).status).toBe(409);
  });

  it('valida o formato: segunda-feira, mudanças, decidedAt e textos', async () => {
    const me = await h.newUser();
    const id = uuid();
    const change = proposal(id).changes[0];
    const bad = [
      proposal(id, { weekStart: '2026-11-24' }),
      proposal(id, { state: 'aceita' }),
      proposal(id, { decidedAt: TEST_NOW }),
      proposal(id, { state: 'quase' }),
      proposal(id, { patternText: '' }),
      proposal(id, { changes: [change, change, change].slice(0, WEEKLY_AI.maxChangesPerProposal + 1) }),
      proposal(id, { changes: [{ ...change, to: { weekday: 1, startMinutes: 1400, durationMinutes: 50 } }] }),
      proposal(id, { changes: [{ ...change, to: { weekday: 1, startMinutes: 100, durationMinutes: 3 } }] }),
    ];
    for (const body of bad) {
      const res = await put(me, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect((await res.json()).error).toBe('corpo_invalido');
    }
    const future = await put(me, decided(id, 'expirada', TEST_NOW + 3_600_000));
    expect((await future.json()).error).toBe('horario_no_futuro');
  });

  it('isolamento: outra pessoa não lê nem expira a proposta alheia', async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    const id = uuid();
    await seed(a, id);
    expect(await listOf(b)).toEqual([]);
    expect((await put(b, decided(id, 'expirada'))).status).toBe(404);
    expect((await listOf(a))[0].state).toBe('pendente');
  });

  it('queries: número fixo com 1 e com 50 propostas', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    await database.db.weeklyProposal.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({
        userId: big.id,
        weekStart: new Date(Date.UTC(2026, 0, 5 + i * 7)),
        state: 'negada' as const,
        patternText: 'p',
        changes: [],
        origin: 'regra' as const,
        createdAt: new Date(TEST_NOW),
        decidedAt: new Date(TEST_NOW),
      })),
    });
    const first = uuid();
    await seed(small, first);

    const get = await queriesOf(database, small, 'GET', '/api/proposals');
    expect(await queriesOf(database, big, 'GET', '/api/proposals')).toBe(get);
    expect(get).toBe(3);

    // 2 de sessão + leitura (1).
    expect(await queriesOf(database, small, 'PUT', `/api/proposals/${first}`, proposal(first))).toBe(3);
  });
});
