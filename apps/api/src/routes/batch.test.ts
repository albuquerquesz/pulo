// Escritas em lote: PUT /api/blocks e PUT /api/habits.
import { API_LIMITS } from '@pulo/core/api/schemas';
import { MAX_HABITS_PER_DAY } from '@pulo/core/config/decisions';
import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { createHarness, queriesOf } from '../testing';

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
const block = (extra: Record<string, unknown> = {}) => ({
  id: uuid(), weekday: 1, startMinutes: 540, durationMinutes: 50, kind: 'foco', ...extra,
});
/** O corpo que um hábito tem na resposta: `active` acompanha o `state`. */
const habit = (extra: Record<string, unknown> = {}) => {
  const body = { id: uuid(), title: 'Beber água', weekdays: [0, 2], active: true, ...extra };
  return { state: body.active === false ? 'arquivado' : 'ativo', ...body };
};
const blocksOf = async (me: Awaited<ReturnType<typeof h.newUser>>) => (await (await me.call('GET', '/api/blocks')).json()).blocks;
const habitsOf = async (me: Awaited<ReturnType<typeof h.newUser>>) => (await (await me.call('GET', '/api/habits')).json()).habits;

describe('PUT /api/blocks (lote)', () => {
  it('exige sessão', async () => {
    expect((await h.app.request('/api/blocks', { method: 'PUT' })).status).toBe(401);
  });

  it('cria vários, atualiza (idempotente) e mistura novos com existentes', async () => {
    const me = await h.newUser();
    const a = block({ title: 'Estudar' });
    const b = block({ weekday: 2, kind: 'descanso' });
    const first = await me.call('PUT', '/api/blocks', { blocks: [a, b] });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ blocks: [a, b] });

    const c = block({ weekday: 3 });
    const changed = { ...a, durationMinutes: 25, title: undefined };
    await me.call('PUT', '/api/blocks', { blocks: [changed, c] });
    await me.call('PUT', '/api/blocks', { blocks: [changed, c] });
    expect(await blocksOf(me)).toEqual([{ ...a, durationMinutes: 25, title: undefined }, b, c].map((x) => JSON.parse(JSON.stringify(x))));
  });

  it('valida cada item e lista os culpados com o caminho (nada é gravado)', async () => {
    const me = await h.newUser();
    const ok = block();
    const res = await me.call('PUT', '/api/blocks', {
      blocks: [ok, block({ durationMinutes: 4 }), block({ weekday: 9 }), block({ id: 'id ruim' })],
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('corpo_invalido');
    expect(body.issues.map((i: { path: string }) => i.path)).toEqual(
      expect.arrayContaining(['blocks.1.durationMinutes', 'blocks.2.weekday', 'blocks.3.id']),
    );
    expect(await blocksOf(me)).toEqual([]);
  });

  it('recusa lote vazio, grande demais e com ids repetidos', async () => {
    const me = await h.newUser();
    expect((await me.call('PUT', '/api/blocks', { blocks: [] })).status).toBe(400);
    const tooMany = Array.from({ length: API_LIMITS.batchMaxBlocks + 1 }, () => block());
    expect((await me.call('PUT', '/api/blocks', { blocks: tooMany })).status).toBe(400);
    const dup = block();
    const res = await me.call('PUT', '/api/blocks', { blocks: [dup, block(), dup] });
    expect(res.status).toBe(400);
    expect((await res.json()).issues).toEqual([{ path: 'blocks.2.id', message: 'id repetido no mesmo lote' }]);
    const max = Array.from({ length: API_LIMITS.batchMaxBlocks }, (_, i) => block({ weekday: i % 7 }));
    expect((await me.call('PUT', '/api/blocks', { blocks: max })).status).toBe(200);
  });

  it('id de outra pessoa: 409 conflito_de_id com os itens, e o lote inteiro é desfeito', async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    const mine = block({ title: 'da A' });
    await a.call('PUT', `/api/blocks/${mine.id}`, mine);

    const fresh = block();
    const res = await b.call('PUT', '/api/blocks', { blocks: [fresh, { ...mine, title: 'roubado' }] });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('conflito_de_id');
    expect(body.issues).toEqual([{ path: 'blocks.1.id', message: 'já existe um registro com este identificador' }]);
    expect(await blocksOf(b)).toEqual([]);
    expect(await blocksOf(a)).toEqual([mine]);
  });

  it('queries: o mesmo número com 1 e com 50 blocos', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    const one = await queriesOf(database, small, 'PUT', '/api/blocks', { blocks: [block()] });
    const fifty = await queriesOf(database, big, 'PUT', '/api/blocks', {
      blocks: Array.from({ length: 50 }, (_, i) => block({ weekday: i % 7, startMinutes: i * 10 })),
    });
    expect(fifty).toBe(one);
    expect(one).toBe(3);
    expect(await blocksOf(big)).toHaveLength(50);
  });
});

describe('PUT /api/habits (lote)', () => {
  it('exige sessão', async () => {
    expect((await h.app.request('/api/habits', { method: 'PUT' })).status).toBe(401);
  });

  it('cria vários (dias repetidos somem e ficam em ordem) e atualiza', async () => {
    const me = await h.newUser();
    const a = habit({ weekdays: [2, 0, 2] });
    const b = habit({ title: 'Alongar', weekdays: [1], active: false });
    const res = await me.call('PUT', '/api/habits', { habits: [a, b] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ habits: [{ ...a, weekdays: [0, 2] }, b] });

    await me.call('PUT', '/api/habits', { habits: [{ ...a, title: 'Ler', weekdays: [0, 2] }] });
    const list = await habitsOf(me);
    expect(list).toHaveLength(2);
    expect(list.find((x: { id: string }) => x.id === a.id).title).toBe('Ler');
  });

  it('aplica o limite por dia contando o lote e os outros hábitos ativos, e lista os itens', async () => {
    const me = await h.newUser();
    const existing = Array.from({ length: MAX_HABITS_PER_DAY - 1 }, () => habit({ weekdays: [5] }));
    expect((await me.call('PUT', '/api/habits', { habits: existing })).status).toBe(200);

    const two = [habit({ weekdays: [5, 6] }), habit({ weekdays: [5] }), habit({ weekdays: [3] })];
    const res = await me.call('PUT', '/api/habits', { habits: two });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('limite_por_dia');
    expect(body.issues.map((i: { path: string }) => i.path)).toEqual(['habits.0.weekdays', 'habits.1.weekdays']);
    expect(await habitsOf(me)).toHaveLength(MAX_HABITS_PER_DAY - 1);

    // Um só no dia 5 cabe; inativo nunca conta; reenviar um existente não o conta duas vezes.
    const ok = await me.call('PUT', '/api/habits', {
      habits: [existing[0], habit({ weekdays: [5] }), habit({ weekdays: [5], active: false })],
    });
    expect(ok.status).toBe(200);
  });

  it('valida itens, ids repetidos e tamanho do lote', async () => {
    const me = await h.newUser();
    const bad = await me.call('PUT', '/api/habits', { habits: [habit(), habit({ title: '  ' }), habit({ weekdays: [] })] });
    expect(bad.status).toBe(400);
    expect((await bad.json()).issues.map((i: { path: string }) => i.path)).toEqual(
      expect.arrayContaining(['habits.1.title', 'habits.2.weekdays']),
    );
    const dup = habit();
    expect((await me.call('PUT', '/api/habits', { habits: [dup, dup] })).status).toBe(400);
    expect((await me.call('PUT', '/api/habits', { habits: [] })).status).toBe(400);
    const tooMany = Array.from({ length: API_LIMITS.batchMaxHabits + 1 }, () => habit({ active: false }));
    expect((await me.call('PUT', '/api/habits', { habits: tooMany })).status).toBe(400);
    expect(await habitsOf(me)).toEqual([]);
  });

  it('id de outra pessoa: 409 conflito_de_id e o lote inteiro é desfeito', async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    const mine = habit();
    await a.call('PUT', `/api/habits/${mine.id}`, mine);
    const res = await b.call('PUT', '/api/habits', { habits: [habit(), { ...mine, title: 'roubado' }] });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('conflito_de_id');
    expect(body.issues).toEqual([{ path: 'habits.1.id', message: 'já existe um registro com este identificador' }]);
    expect(await habitsOf(b)).toEqual([]);
    expect(await habitsOf(a)).toEqual([mine]);
  });

  it('queries: o mesmo número com 1 e com 50 hábitos', async () => {
    const small = await h.newUser();
    const big = await h.newUser();
    const one = await queriesOf(database, small, 'PUT', '/api/habits', { habits: [habit()] });
    // 50 itens, dos quais só 30 ativos (7 dias x 5 = 35 vagas por semana).
    const fifty = await queriesOf(database, big, 'PUT', '/api/habits', {
      habits: Array.from({ length: 50 }, (_, i) => habit({ weekdays: [i % 7], active: i < 30 })),
    });
    expect(fifty).toBe(one);
    expect(one).toBe(4);
    expect(await habitsOf(big)).toHaveLength(50);
  });
});
