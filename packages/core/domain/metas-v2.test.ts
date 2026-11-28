import { GOALS, JOIAS, MAX_HABITS_PER_DAY } from '../config/decisions';
import { createMemoryRepository } from '../data/memory-repository';
import { DAY_MS, HOUR_MS } from './clock';
import { abrirBau, apagarMeta, concluirMeta, criarMeta, editarMeta, estadoDoBau, numerosDaMeta, podeAbrirBau, reabrirMeta, ritmo, validarEscritaDaMeta } from './goals';
import { atrelarHabito, criarHabito, editarHabito } from './habits';
import { joiasDosHabitos, joiasGanhas, marcosPagos } from './joias';
import type { Goal } from './types';

const meiaNoite = (dia: number) => Date.UTC(2026, 10, dia, 15);
const meta = (extra: Partial<Goal> = {}): Goal => ({
  id: 'm',
  title: 'x',
  state: 'ativa',
  createdAt: meiaNoite(1),
  targetDate: '2026-11-11',
  milestones: [],
  ...extra,
});
const marcos = (feitos: number, total = 10) =>
  Array.from({ length: total }, (_, i) => ({ id: `${i}`, title: 'p', ...(i < feitos ? { doneAt: 1 } : {}) }));

describe('ritmo', () => {
  it('sem data alvo', () => {
    const { targetDate: _t, ...semData } = meta();
    expect(ritmo(semData, '2026-11-20')).toEqual({ esperado: 0, atual: 0, estado: 'sem-data' });
  });

  it('no começo, nada é esperado', () => {
    expect(ritmo(meta(), '2026-11-01')).toEqual({ esperado: 0, atual: 0, estado: 'no-ritmo' });
  });

  it.each([
    [5, 'no-ritmo'],
    [4, 'no-ritmo'],
    [3, 'atras'],
    [9, 'no-ritmo'],
  ])('no meio do prazo com %i de 10 marcos: %s', (feitos, estado) => {
    expect(ritmo(meta({ milestones: marcos(feitos) }), '2026-11-06')).toMatchObject({ esperado: 0.5, estado });
    expect(GOALS.paceTolerance).toBe(0.1);
  });

  it('meta vencida e incompleta está atrás, mesmo dentro da tolerância', () => {
    expect(ritmo(meta({ milestones: marcos(9) }), '2026-11-12')).toEqual({ esperado: 1, atual: 0.9, estado: 'atras' });
    expect(ritmo(meta({ milestones: marcos(10) }), '2026-11-12').estado).toBe('no-ritmo');
  });

  it('prazo no próprio dia da criação espera tudo', () => {
    expect(ritmo(meta({ targetDate: '2026-11-01' }), '2026-11-01')).toMatchObject({ esperado: 1, estado: 'atras' });
  });

  it('concluída', () => {
    expect(ritmo(meta({ state: 'concluida', completedAt: 1 }), '2026-12-01')).toEqual({ esperado: 1, atual: 1, estado: 'concluida' });
  });
});

describe('números da meta', () => {
  it('conta hábitos atrelados, vezes feitos e foco sem contar em dobro', () => {
    const sessao = (id: string, extra: { goalId?: string; habitId?: string }) => ({
      id,
      startedAt: 0,
      endedAt: 25 * 60_000,
      plannedMinutes: 25,
      state: 'concluida' as const,
      pausedMs: 0,
      ...extra,
    });
    const numeros = numerosDaMeta(
      meta(),
      {
        habits: [
          { id: 'a', title: 'a', weekdays: [0], state: 'ativo', goalId: 'm' },
          { id: 'b', title: 'b', weekdays: [0], state: 'ativo' },
        ],
        habitLogs: [
          { habitId: 'a', date: '2026-11-02', doneAt: 1 },
          { habitId: 'b', date: '2026-11-02', doneAt: 1 },
        ],
        sessions: [
          sessao('1', { goalId: 'm' }),
          sessao('2', { habitId: 'a' }),
          sessao('3', { habitId: 'a', goalId: 'm' }),
          sessao('4', { habitId: 'a', goalId: 'outra' }),
          sessao('5', { habitId: 'b' }),
          sessao('6', {}),
        ],
      },
      '2026-11-06',
    );
    expect(numeros).toMatchObject({ habitosFeitos: 1, minutosDeFoco: 75, diasRestantes: 5 });
    expect(numeros.habitos.map((h) => h.id)).toEqual(['a']);
  });
});

/** Um instante em que uma meta criada em 1 já tem idade para o baú. */
const MADURA = GOALS.bau.idadeMinimaDias * DAY_MS + 1;

describe('baú, ícone e hábitos atrelados', () => {
  async function preparar() {
    const repo = createMemoryRepository();
    const criada = await criarMeta(repo, { title: 'x', icon: ' 🏃 ', color: 'foco' }, 1, '2026-11-01');
    if (!criada.ok) throw new Error(criada.error.message);
    return { repo, goal: criada.value };
  }
  const joias = async (repo: Awaited<ReturnType<typeof preparar>>['repo']) =>
    joiasGanhas({ habitLogs: [], sessions: [], restDays: [], goals: await repo.listGoals(), baus: await repo.listGoalChests(), credito: 0 }).metas;

  it('a meta concluída só paga depois do baú aberto, uma vez, mesmo reabrindo', async () => {
    const { repo, goal } = await preparar();
    expect(await abrirBau(repo, goal.id, 2)).toMatchObject({ ok: false, error: { code: 'meta_nao_concluida' } });
    const concluida = await concluirMeta(repo, goal.id, 3);
    expect(concluida.ok && estadoDoBau(concluida.value, [])).toBe('fechado');
    expect(await joias(repo)).toBe(0);
    expect(await abrirBau(repo, goal.id, MADURA)).toEqual({ ok: true, value: { goalId: goal.id, abertoEm: MADURA, joias: JOIAS.por.goalCompleted } });
    expect(await abrirBau(repo, goal.id, MADURA + 1)).toMatchObject({ ok: false, error: { code: 'bau_ja_aberto' } });
    await reabrirMeta(repo, goal.id);
    await concluirMeta(repo, goal.id, 6);
    expect(await abrirBau(repo, goal.id, MADURA + 3)).toMatchObject({ ok: false, error: { code: 'bau_ja_aberto' } });
    expect(await joias(repo)).toBe(JOIAS.por.goalCompleted);
  });

  it('ícone e cor ficam na edição que não fala deles', async () => {
    const { repo, goal } = await preparar();
    expect(goal).toMatchObject({ icon: '🏃', color: 'foco' });
    expect(await editarMeta(repo, goal.id, { title: 'y' }, '2026-11-01')).toMatchObject({ value: { icon: '🏃', color: 'foco' } });
    expect(await editarMeta(repo, goal.id, { title: 'y', icon: 'duas palavras' }, '2026-11-01')).toMatchObject({ error: { code: 'icone_invalido' } });
  });

  it('atrela, mantém na edição, solta e a meta apagada leva o baú e solta o hábito', async () => {
    const { repo, goal } = await preparar();
    const habito = await criarHabito(repo, { title: 'ler', weekdays: [0] }, 1);
    if (!habito.ok) throw new Error(habito.error.message);
    const { id } = habito.value;
    expect(await atrelarHabito(repo, id, 'nada')).toMatchObject({ error: { code: 'meta_inexistente' } });
    await atrelarHabito(repo, id, goal.id);
    expect(await editarHabito(repo, id, { title: 'ler mais' })).toMatchObject({ value: { goalId: goal.id } });
    await atrelarHabito(repo, id, null);
    expect((await repo.listHabits())[0]).not.toHaveProperty('goalId');
    await atrelarHabito(repo, id, goal.id);
    await concluirMeta(repo, goal.id, 2);
    await abrirBau(repo, goal.id, MADURA);
    await apagarMeta(repo, goal.id);
    expect((await repo.listHabits())[0]).not.toHaveProperty('goalId');
    expect(await repo.listGoalChests()).toEqual([]);
  });
});

describe('regras do baú', () => {
  const now = meiaNoite(20);
  const pronta = meta({ state: 'concluida', completedAt: now, createdAt: now - GOALS.bau.idadeMinimaDias * DAY_MS });
  const codigo = (m: Goal, baus: Parameters<typeof podeAbrirBau>[1] = []) => {
    const r = podeAbrirBau(m, baus, now);
    return r.ok ? 'ok' : r.error.code;
  };

  it('pede idade, todos os marcos e respeita o teto do período', () => {
    expect(codigo(pronta)).toBe('ok');
    expect(codigo({ ...pronta, createdAt: pronta.createdAt + 1 })).toBe('meta_nova_demais');
    expect(codigo({ ...pronta, milestones: marcos(1, 2) })).toBe('marcos_pendentes');
    const baus = Array.from({ length: GOALS.bau.maxPorPeriodo }, (_, i) => ({ goalId: `${i}`, abertoEm: now - DAY_MS, joias: 10 }));
    expect(codigo(pronta, baus)).toBe('limite_de_baus');
    const antigos = baus.map((b) => ({ ...b, abertoEm: now - GOALS.bau.periodoDias * DAY_MS }));
    expect(codigo(pronta, antigos)).toBe('ok');
  });
});

describe('datas da meta', () => {
  const now = meiaNoite(20);
  const nova = meta({ createdAt: now, targetDate: '2027-01-01' });
  const valida = (m: Goal, anterior?: Goal) => {
    const r = validarEscritaDaMeta({ meta: m, anterior, now, timeZone: 'America/Sao_Paulo', folgaMs: 0 });
    return r.ok ? 'ok' : r.error.code;
  };
  const velho = now - GOALS.datasMaxHorasAtras * HOUR_MS - 1;

  it('meta nova começa ativa e com datas de agora', () => {
    expect(valida(nova)).toBe('ok');
    expect(valida({ ...nova, state: 'concluida', completedAt: now })).toBe('meta_criada_concluida');
    for (const extra of [
      { createdAt: velho },
      { createdAt: now + 1 },
      { targetDate: '2026-11-01' },
      { targetDate: '2999-01-01' },
      { milestones: [{ id: 'm', title: 'x', doneAt: velho }] },
    ]) {
      expect(valida({ ...nova, ...extra })).toBe('data_da_meta_invalida');
    }
  });

  it('o que já estava gravado continua valendo; o que muda precisa ser de agora', () => {
    const gravada = meta({ createdAt: 1, targetDate: '2020-01-01', milestones: [{ id: 'm', title: 'x', doneAt: 5 }] });
    expect(valida({ ...gravada, title: 'y' }, gravada)).toBe('ok');
    expect(valida({ ...gravada, state: 'concluida', completedAt: now }, gravada)).toBe('ok');
    expect(valida({ ...gravada, state: 'concluida', completedAt: velho }, gravada)).toBe('data_da_meta_invalida');
    expect(valida({ ...gravada, milestones: [{ id: 'm', title: 'x', doneAt: 6 }] }, gravada)).toBe('data_da_meta_invalida');
  });
});

describe('tetos de joias por dia', () => {
  it(`paga no máximo ${MAX_HABITS_PER_DAY} hábitos por dia`, () => {
    expect(joiasDosHabitos([MAX_HABITS_PER_DAY + 3, 2])).toBe((MAX_HABITS_PER_DAY + 2) * JOIAS.por.habitDone);
    const habitLogs = Array.from({ length: 9 }, (_, i) => ({ habitId: `${i}`, date: '2026-11-02', doneAt: 1 }));
    const vazio = { sessions: [], restDays: [], goals: [], baus: [], credito: 0 };
    expect(joiasGanhas({ ...vazio, habitLogs }).habitos).toBe(MAX_HABITS_PER_DAY);
    expect(joiasGanhas({ ...vazio, habitLogs: [], foraDaJanela: 7 }).total).toBe(7);
  });

  it(`paga no máximo ${JOIAS.maxMarcosPorDia} marcos por dia, somando as metas`, () => {
    const feitos = (dia: number) => meta({ milestones: [0, 1, 2].map((i) => ({ id: `${dia}-${i}`, title: 'x', doneAt: meiaNoite(dia) })) });
    expect(marcosPagos([feitos(2), feitos(2)])).toHaveLength(JOIAS.maxMarcosPorDia);
    expect(marcosPagos([feitos(2), feitos(3)])).toHaveLength(2 * JOIAS.maxMarcosPorDia);
  });
});
