import { GOALS, JOIAS } from '../config/decisions';
import { createMemoryRepository } from '../data/memory-repository';
import { abrirBau, apagarMeta, concluirMeta, criarMeta, editarMeta, estadoDoBau, numerosDaMeta, reabrirMeta, ritmo } from './goals';
import { atrelarHabito, criarHabito, editarHabito } from './habits';
import { joiasGanhas } from './joias';
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
    expect(await abrirBau(repo, goal.id, 4)).toEqual({ ok: true, value: { goalId: goal.id, abertoEm: 4, joias: JOIAS.por.goalCompleted } });
    expect(await abrirBau(repo, goal.id, 5)).toMatchObject({ ok: false, error: { code: 'bau_ja_aberto' } });
    await reabrirMeta(repo, goal.id);
    await concluirMeta(repo, goal.id, 6);
    expect(await abrirBau(repo, goal.id, 7)).toMatchObject({ ok: false, error: { code: 'bau_ja_aberto' } });
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
    await abrirBau(repo, goal.id, 3);
    await apagarMeta(repo, goal.id);
    expect((await repo.listHabits())[0]).not.toHaveProperty('goalId');
    expect(await repo.listGoalChests()).toEqual([]);
  });
});
