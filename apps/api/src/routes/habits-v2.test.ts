import { HABITS, MAX_HABITS_PER_DAY } from '@pulo/core/config/decisions';
import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { type TestUser, createHarness, queriesOf } from '../testing';

/** Sessão e usuário, mais três leituras: o hábito, os registros dele e os descansos. */
const STATS_QUERIES = 5;

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
const base = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: 'Ler', weekdays: [0], ...extra });
const look = { icon: '📚', color: 'sol', period: 'noite', reminderMinutes: 1260, reminderOn: true };
const put = async (me: TestUser, body: { id: string }) => (await me.call('PUT', `/api/habits/${body.id}`, body)).json();
const batch = async (me: TestUser, habits: unknown[]) => (await me.call('PUT', '/api/habits', { habits })).json();
const list = async (me: TestUser) => (await (await me.call('GET', '/api/habits')).json()).habits;

describe('hábitos v2: campos novos', () => {
  for (const [nome, gravar] of [
    ['um hábito', async (me: TestUser, body: { id: string }) => (await put(me, body)).habit],
    ['lote', async (me: TestUser, body: { id: string }) => (await batch(me, [body])).habits[0]],
  ] as const) {
    it(`${nome}: grava, mantém quando omitido (cliente antigo) e limpa com null`, async () => {
      const me = await h.newUser();
      const id = uuid();
      const completo = { ...base(id, look), state: 'ativo', active: true };
      expect(await gravar(me, base(id, look))).toEqual(completo);
      expect(await gravar(me, base(id, { active: true, title: 'Outro' }))).toEqual({ ...completo, title: 'Outro' });
      expect(await list(me)).toEqual([{ ...completo, title: 'Outro' }]);
      expect((await (await me.call('GET', '/api/sync?from=2026-11-01&to=2026-11-30')).json()).habits).toEqual([{ ...completo, title: 'Outro' }]);

      // Desligar o lembrete não perde o horário.
      expect(await gravar(me, base(id, { reminderOn: false }))).toMatchObject({ reminderMinutes: 1260 });
      expect((await list(me))[0]).not.toHaveProperty('reminderOn');
      // Sem horário não há lembrete ligado.
      const limpo = await gravar(me, base(id, { icon: null, color: null, period: null, reminderMinutes: null, reminderOn: true }));
      expect(limpo).toEqual({ ...base(id), state: 'ativo', active: true });
      expect(await list(me)).toEqual([limpo]);
    });

    it(`${nome}: o cliente antigo não desfaz pausa nem arquivo, e reativa com active true`, async () => {
      const me = await h.newUser();
      const id = uuid();
      expect(await gravar(me, base(id, { state: 'pausado' }))).toMatchObject({ state: 'pausado', active: false });
      expect(await gravar(me, base(id, { active: false }))).toMatchObject({ state: 'pausado' });
      expect(await gravar(me, base(id))).toMatchObject({ state: 'pausado' });
      expect(await gravar(me, base(id, { active: true }))).toMatchObject({ state: 'ativo', active: true });
      expect(await gravar(me, base(id, { active: false }))).toMatchObject({ state: 'arquivado', active: false });
      expect(await database.db.habit.findUnique({ where: { id }, select: { state: true, active: true } })).toEqual({ state: 'arquivado', active: false });
    });
  }

  it('o limite por dia ignora pausados e arquivados, e reativar passa por ele', async () => {
    const me = await h.newUser();
    const ativos = Array.from({ length: MAX_HABITS_PER_DAY }, () => base(uuid()));
    const parados = [base(uuid(), { state: 'pausado' }), base(uuid(), { state: 'arquivado' })];
    expect((await me.call('PUT', '/api/habits', { habits: [...ativos, ...parados] })).status).toBe(200);
    for (const parado of parados) {
      expect((await me.call('PUT', `/api/habits/${parado.id}`, { ...parado, state: 'ativo' })).status).toBe(409);
    }
    // Pausar um abre a vaga.
    await put(me, { ...ativos[0], ...{ state: 'pausado' } });
    expect((await me.call('PUT', `/api/habits/${parados[0].id}`, { ...parados[0], state: 'ativo' })).status).toBe(200);
  });

  it('valida os campos novos', async () => {
    const me = await h.newUser();
    for (const extra of [{ state: 'sumido' }, { icon: 'dois emojis' }, { icon: 'x'.repeat(HABITS.iconMaxChars + 1) }, { color: '#fff' }, { period: 'madrugada' }, { reminderMinutes: 1440 }]) {
      const id = uuid();
      expect((await me.call('PUT', `/api/habits/${id}`, base(id, extra))).status).toBe(400);
    }
  });

  it('exporta os campos novos e a data de criação', async () => {
    const me = await h.newUser();
    const id = uuid();
    await put(me, base(id, look));
    const exported = await (await me.call('GET', '/api/data/export')).json();
    expect(exported.habits).toEqual([{ ...base(id, look), state: 'ativo', active: true, createdAt: expect.any(Number) }]);
  });
});

describe('ícone do bloco', () => {
  const bloco = (id: string, extra: Record<string, unknown> = {}) => ({ id, weekday: 0, startMinutes: 540, durationMinutes: 25, kind: 'foco', ...extra });

  it('um bloco e lote: grava, mantém quando omitido e tira com null', async () => {
    const me = await h.newUser();
    const [a, b] = [uuid(), uuid()];
    const um = async (body: { id: string }) => (await (await me.call('PUT', `/api/blocks/${body.id}`, body)).json()).block;
    const lote = async (blocks: unknown[]) => (await (await me.call('PUT', '/api/blocks', { blocks })).json()).blocks;

    expect(await um(bloco(a, { icon: '🐸' }))).toEqual(bloco(a, { icon: '🐸' }));
    expect(await um(bloco(a))).toEqual(bloco(a, { icon: '🐸' }));
    expect(await lote([bloco(a), bloco(b, { icon: '🌙' })])).toEqual([bloco(a, { icon: '🐸' }), bloco(b, { icon: '🌙' })]);
    expect(await lote([bloco(a, { icon: null }), bloco(b)])).toEqual([bloco(a), bloco(b, { icon: '🌙' })]);
    expect(await um(bloco(b, { icon: null }))).toEqual(bloco(b));
    expect((await (await me.call('GET', '/api/blocks')).json()).blocks).toEqual(expect.arrayContaining([bloco(a), bloco(b)]));
    expect((await me.call('PUT', `/api/blocks/${a}`, bloco(a, { icon: '' }))).status).toBe(400);
  });

  it('o lote de outra pessoa não copia nem altera o ícone', async () => {
    const [dona, outra] = [await h.newUser(), await h.newUser()];
    const id = uuid();
    await dona.call('PUT', `/api/blocks/${id}`, bloco(id, { icon: '🐸' }));
    expect((await outra.call('PUT', '/api/blocks', { blocks: [bloco(id)] })).status).toBe(409);
    expect((await (await dona.call('GET', '/api/blocks')).json()).blocks).toEqual([bloco(id, { icon: '🐸' })]);
  });
});

describe('GET /api/habits/:id/stats', () => {
  it('exige sessão e só mostra o hábito da própria pessoa', async () => {
    const [dona, outra] = [await h.newUser(), await h.newUser()];
    const id = uuid();
    await put(dona, base(id));
    expect((await h.app.request(`/api/habits/${id}/stats`)).status).toBe(401);
    for (const alvo of [id, uuid()]) {
      const res = await outra.call('GET', `/api/habits/${alvo}/stats`);
      expect([res.status, (await res.json()).error]).toEqual([404, 'referencia_inexistente']);
    }
  });

  it('calcula do histórico, com descanso e férias', async () => {
    // TEST_NOW é na semana de 16/11/2026; segunda a sexta.
    const me = await h.newUser();
    const id = uuid();
    await database.db.habit.create({ data: { id, userId: me.id, title: 'Ler', weekdays: [0, 1, 2, 3, 4], createdAt: new Date('2026-11-09T12:00:00Z') } });
    await database.db.habitLog.createMany({
      data: ['2026-11-09', '2026-11-11'].map((date) => ({ habitId: id, userId: me.id, date: new Date(date), doneAt: new Date(date) })),
    });
    await database.db.restDay.create({ data: { userId: me.id, date: new Date('2026-11-10') } });

    const { stats } = await (await me.call('GET', `/api/habits/${id}/stats`)).json();
    expect(stats).toMatchObject({ recorde: 2, total: 2 });
    expect(stats.calendario).toHaveLength(HABITS.statsWeeks);
    const estados = new Map(stats.calendario.flat().map((d: { date: string; estado: string }) => [d.date, d.estado]));
    expect(['2026-11-06', '2026-11-09', '2026-11-10', '2026-11-12'].map((d) => estados.get(d))).toEqual(['fora', 'feito', 'descanso', 'vazio']);
  });

  it('queries: número fixo com 1 e com 50 registros', async () => {
    const [pouco, muito] = [await h.newUser(), await h.newUser()];
    const medir = async (me: TestUser, n: number) => {
      const id = uuid();
      await database.db.habit.create({ data: { id, userId: me.id, title: 'Ler', weekdays: [0] } });
      const dias = Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 8, 1 + i)));
      await database.db.habitLog.createMany({ data: dias.map((date) => ({ habitId: id, userId: me.id, date, doneAt: date })) });
      await database.db.restDay.createMany({ data: dias.map((date) => ({ userId: me.id, date })) });
      return queriesOf(database, me, 'GET', `/api/habits/${id}/stats`);
    };
    const um = await medir(pouco, 1);
    expect(await medir(muito, 50)).toBe(um);
    expect(um).toBe(STATS_QUERIES);
  });
});
