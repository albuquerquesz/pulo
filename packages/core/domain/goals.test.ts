import { createMemoryRepository } from '../data/memory-repository';
import {
  adicionarMarco,
  alternarMarco,
  concluirMeta,
  criarMeta,
  daysUntilTarget,
  editarMeta,
  goalProgress,
  reabrirMeta,
  removerMarco,
  sortGoals,
} from './goals';

const HOJE = '2026-11-23';

async function criar(repo = createMemoryRepository(), title = 'Correr uma maratona', now = 1) {
  const r = await criarMeta(repo, { title, why: ' saúde ', targetDate: '2027-06-01', milestones: ['5 km', ' ', '10 km'] }, now, HOJE);
  if (!r.ok) throw new Error(r.error.message);
  return { repo, goal: r.value };
}

describe('metas', () => {
  it('cria com título limpo, porquê, prazo e marcos sem os vazios', async () => {
    const { repo, goal } = await criar();
    expect(goal).toMatchObject({ title: 'Correr uma maratona', why: 'saúde', targetDate: '2027-06-01', state: 'ativa' });
    expect(goal.milestones.map((m) => m.title)).toEqual(['5 km', '10 km']);
    expect(await repo.listGoals()).toEqual([goal]);
  });

  it('recusa título vazio e prazo no passado', async () => {
    const repo = createMemoryRepository();
    const vazio = await criarMeta(repo, { title: '  ' }, 1, HOJE);
    expect(!vazio.ok && vazio.error.code).toBe('titulo_vazio');
    const passado = await criarMeta(repo, { title: 'x', targetDate: '2026-11-22' }, 1, HOJE);
    expect(!passado.ok && passado.error.code).toBe('prazo_no_passado');
  });

  it('aceita até 3 ativas; concluir abre espaço e reabrir respeita o limite', async () => {
    const repo = createMemoryRepository();
    const ids: string[] = [];
    for (let i = 0; i < 3; i += 1) ids.push((await criar(repo, `m${i}`, i)).goal.id);
    const quarta = await criarMeta(repo, { title: 'quarta' }, 9, HOJE);
    expect(!quarta.ok && quarta.error.code).toBe('limite_de_metas');

    await concluirMeta(repo, ids[0], 10);
    expect((await criarMeta(repo, { title: 'quarta' }, 11, HOJE)).ok).toBe(true);
    const reaberta = await reabrirMeta(repo, ids[0]);
    expect(!reaberta.ok && reaberta.error.code).toBe('limite_de_metas');
  });

  it('marcos: adicionar, riscar, desriscar e remover mudam o progresso', async () => {
    const { repo, goal } = await criar();
    const add = await adicionarMarco(repo, goal.id, 'Meia maratona', 5);
    if (!add.ok) throw new Error('x');
    expect(goalProgress(add.value)).toEqual({ done: 0, total: 3, ratio: 0 });

    const primeiro = add.value.milestones[0].id;
    const riscado = await alternarMarco(repo, goal.id, primeiro, 7);
    if (!riscado.ok) throw new Error('x');
    expect(riscado.value.milestones[0].doneAt).toBe(7);
    expect(goalProgress(riscado.value).done).toBe(1);

    const desriscado = await alternarMarco(repo, goal.id, primeiro, 8);
    expect(desriscado.ok && 'doneAt' in desriscado.value.milestones[0]).toBe(false);

    const removido = await removerMarco(repo, goal.id, primeiro);
    expect(removido.ok && removido.value.milestones).toHaveLength(2);
    expect(!(await alternarMarco(repo, goal.id, 'nada', 1)).ok).toBe(true);
  });

  it('editar troca texto e prazo, e apaga o porquê vazio', async () => {
    const { repo, goal } = await criar();
    const r = await editarMeta(repo, goal.id, { title: 'Maratona de SP', why: '', targetDate: undefined }, HOJE);
    expect(r.ok && r.value).toMatchObject({ title: 'Maratona de SP' });
    expect(r.ok && ('why' in r.value || 'targetDate' in r.value)).toBe(false);
  });

  it('reabrir tira a data de conclusão; ordenação põe ativas pelo prazo e depois as concluídas', async () => {
    const repo = createMemoryRepository();
    const longe = (await criarMeta(repo, { title: 'longe', targetDate: '2030-01-01' }, 1, HOJE)).ok;
    const semPrazo = await criarMeta(repo, { title: 'sem prazo' }, 2, HOJE);
    const perto = await criarMeta(repo, { title: 'perto', targetDate: '2027-01-01' }, 3, HOJE);
    expect(longe && semPrazo.ok && perto.ok).toBe(true);
    if (!semPrazo.ok) throw new Error('x');
    await concluirMeta(repo, semPrazo.value.id, 4);
    expect(sortGoals(await repo.listGoals()).map((g) => g.title)).toEqual(['perto', 'longe', 'sem prazo']);

    const reaberta = await reabrirMeta(repo, semPrazo.value.id);
    expect(reaberta.ok && reaberta.value.state).toBe('ativa');
    expect(reaberta.ok && 'completedAt' in reaberta.value).toBe(false);
  });

  it('dias até o prazo', async () => {
    const { goal } = await criar();
    expect(daysUntilTarget(goal, '2027-05-31')).toBe(1);
    expect(daysUntilTarget({ ...goal, targetDate: undefined }, HOJE)).toBeNull();
  });
});
