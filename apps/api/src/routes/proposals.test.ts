import { WEEKLY_AI } from '@pulo/core/config/decisions';
import { PROPOSAL_UNDO_GRACE_MS } from '@pulo/core/api/proposal-state';
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
const listOf = async (user: TestUser) => (await (await user.call('GET', '/api/proposals')).json()).proposals;

describe('/api/proposals', () => {
  it('exige sessão', async () => {
    expect((await h.app.request('/api/proposals')).status).toBe(401);
    expect((await h.app.request(`/api/proposals/${uuid()}`, { method: 'PUT' })).status).toBe(401);
  });

  it('cria, lê e decide uma proposta pendente', async () => {
    const me = await h.newUser();
    const id = uuid();
    const created = await put(me, proposal(id));
    expect(created.status).toBe(200);
    expect(await created.json()).toEqual({ proposal: proposal(id) });
    expect((await put(me, proposal(id))).status).toBe(200);

    const weeks = ['2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21'];
    for (const [i, state] of ['aceita', 'editada', 'negada', 'expirada'].entries()) {
      const other = uuid();
      await put(me, proposal(other, { weekStart: weeks[i] }));
      const res = await put(me, decided(other, state, TEST_NOW, { weekStart: weeks[i] }));
      expect(res.status, state).toBe(200);
    }
    expect((await listOf(me)).length).toBe(5);
  });

  it('decidida só volta a pendente dentro da janela de desfazer; expirada é final', async () => {
    const me = await h.newUser();
    const id = uuid();
    await put(me, proposal(id));
    await put(me, decided(id, 'aceita', TEST_NOW));

    // Outra decisão direta: inválida.
    const other = await put(me, decided(id, 'negada'));
    expect(other.status).toBe(409);
    expect((await other.json()).error).toBe('proposta_transicao_invalida');

    // Desfazer a tempo.
    h.setNow(TEST_NOW + WEEKLY_AI.undoSeconds * 1000);
    expect((await put(me, proposal(id))).status).toBe(200);
    expect((await listOf(me))[0].state).toBe('pendente');

    // Depois da janela (mais a folga) não desfaz.
    await put(me, decided(id, 'negada', TEST_NOW + WEEKLY_AI.undoSeconds * 1000));
    h.setNow(TEST_NOW + WEEKLY_AI.undoSeconds * 1000 * 2 + PROPOSAL_UNDO_GRACE_MS + 1000);
    const late = await put(me, proposal(id));
    expect(late.status).toBe(409);
    expect((await late.json()).error).toBe('proposta_transicao_invalida');
    h.setNow(TEST_NOW);

    const expired = uuid();
    await put(me, proposal(expired, { weekStart: '2026-12-07' }));
    await put(me, decided(expired, 'expirada', TEST_NOW, { weekStart: '2026-12-07' }));
    expect((await put(me, proposal(expired, { weekStart: '2026-12-07' }))).status).toBe(409);
  });

  it('repetir a mesma decisão é idempotente; semana, origem e criação não mudam', async () => {
    const me = await h.newUser();
    const id = uuid();
    await put(me, proposal(id, { weekStart: '2026-12-14' }));
    const accepted = decided(id, 'aceita', TEST_NOW, { weekStart: '2026-12-14' });
    expect((await put(me, accepted)).status).toBe(200);
    expect((await put(me, accepted)).status).toBe(200);
    expect((await put(me, { ...accepted, id, patternText: 'outro texto' })).status).toBe(409);

    const other = uuid();
    await put(me, proposal(other, { weekStart: '2026-12-21' }));
    for (const change of [{ origin: 'ia' }, { createdAt: TEST_NOW - 5 }]) {
      const res = await put(me, proposal(other, { weekStart: '2026-12-21', ...change }));
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('proposta_imutavel');
    }
    const moved = await put(me, proposal(other, { weekStart: '2026-12-28' }));
    expect((await moved.json()).error).toBe('proposta_imutavel');
  });

  it('uma proposta por semana', async () => {
    const me = await h.newUser();
    await put(me, proposal(uuid(), { weekStart: '2027-01-04' }));
    const dup = await put(me, proposal(uuid(), { weekStart: '2027-01-04' }));
    expect(dup.status).toBe(409);
    expect((await dup.json()).error).toBe('semana_ja_tem_proposta');
    // Outra pessoa pode ter a mesma semana.
    const other = await h.newUser();
    expect((await put(other, proposal(uuid(), { weekStart: '2027-01-04' }))).status).toBe(200);
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
    const future = await put(me, proposal(id, { createdAt: TEST_NOW + 3_600_000 }));
    expect((await future.json()).error).toBe('horario_no_futuro');
  });

  it('isolamento: outra pessoa não lê nem decide a proposta alheia', async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    const id = uuid();
    await put(a, proposal(id, { weekStart: '2027-02-01' }));
    expect(await listOf(b)).toEqual([]);
    const steal = await put(b, decided(id, 'aceita'));
    expect(steal.status).toBe(409);
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
    await put(small, proposal(first));

    const get = await queriesOf(database, small, 'GET', '/api/proposals');
    expect(await queriesOf(database, big, 'GET', '/api/proposals')).toBe(get);
    expect(get).toBe(3);

    const bigId = uuid();
    const same = await queriesOf(database, small, 'PUT', `/api/proposals/${first}`, proposal(first));
    const created = await queriesOf(database, big, 'PUT', `/api/proposals/${bigId}`, proposal(bigId, { weekStart: '2030-01-07' }));
    // 2 de sessão + leitura (1) + upsert (1).
    expect(same).toBe(4);
    expect(created).toBe(4);
  });
});
