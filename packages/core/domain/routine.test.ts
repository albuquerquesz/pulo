import { createMemoryRepository } from '../data/memory-repository';
import {
  concluirBloco,
  criarBloco,
  criarPlanoInicial,
  desfazerBloco,
  editarBloco,
  encurtarBloco,
  moverBloco,
  removerBloco,
} from './routine';
import { endedSession, sp } from './test-utils';
import type { Habit, RoutineBlock } from './types';
import { WEEKLY_AI } from '../config/decisions';

const base = { weekday: 0 as const, startMinutes: 540, durationMinutes: 25, kind: 'foco' as const };

describe('blocos', () => {
  it('cria bloco válido e recusa duração fora de 5 a 120', async () => {
    const repo = createMemoryRepository();
    expect((await criarBloco(repo, base, 1)).ok).toBe(true);
    for (const d of [4, 121, 0, 25.5]) {
      const r = await criarBloco(repo, { ...base, weekday: 1, durationMinutes: d }, 2);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('duracao_invalida');
    }
    expect((await criarBloco(repo, { ...base, weekday: 2, durationMinutes: 5 }, 3)).ok).toBe(true);
    expect((await criarBloco(repo, { ...base, weekday: 3, durationMinutes: 120 }, 3)).ok).toBe(true);
    expect(await repo.listBlocks()).toHaveLength(3);
  });
  it('recusa sobreposição e sugere o próximo horário livre', async () => {
    const repo = createMemoryRepository();
    await criarBloco(repo, base, 1);
    await criarBloco(repo, { ...base, startMinutes: 565 }, 2); // 9:25 encosta, não sobrepõe
    const r = await criarBloco(repo, { ...base, startMinutes: 550 }, 3);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('sobreposicao');
      expect(r.error.suggestedStartMinutes).toBe(590);
    }
  });
  it('bloco precisa caber no dia', async () => {
    const repo = createMemoryRepository();
    const r = await criarBloco(repo, { ...base, startMinutes: 1430 }, 1);
    expect(!r.ok && r.error.code).toBe('horario_invalido');
  });
  it('edita ignorando a si mesmo na sobreposição', async () => {
    const repo = createMemoryRepository();
    const b = await criarBloco(repo, base, 1);
    if (!b.ok) throw new Error('x');
    const e = await editarBloco(repo, b.value.id, { durationMinutes: 30 });
    expect(e.ok && e.value.durationMinutes).toBe(30);
  });
  it('mover devolve o anterior e desfazer restaura', async () => {
    const repo = createMemoryRepository();
    const b = await criarBloco(repo, base, 1);
    if (!b.ok) throw new Error('x');
    const m = await moverBloco(repo, b.value.id, 2, 600, 1000);
    if (!m.ok) throw new Error('x');
    expect(m.value.block).toMatchObject({ weekday: 2, startMinutes: 600 });
    expect(m.value.undo.previous).toMatchObject({ weekday: 0, startMinutes: 540 });
    expect((await repo.listBlocks())[0]).toMatchObject({ weekday: 2, startMinutes: 600 });
    const u = await desfazerBloco(repo, m.value.undo, 1000 + 1000);
    expect(u.ok).toBe(true);
    expect((await repo.listBlocks())[0]).toMatchObject({ weekday: 0, startMinutes: 540 });
  });
  it('desfazer expira depois da janela', async () => {
    const repo = createMemoryRepository();
    const b = await criarBloco(repo, base, 1);
    if (!b.ok) throw new Error('x');
    const m = await moverBloco(repo, b.value.id, 2, 600, 1000);
    if (!m.ok) throw new Error('x');
    const u = await desfazerBloco(repo, m.value.undo, 1000 + WEEKLY_AI.undoSeconds * 1000 + 1);
    expect(!u.ok && u.error.code).toBe('desfazer_expirado');
    expect((await repo.listBlocks())[0].weekday).toBe(2);
  });
  it('mover para horário ocupado é recusado e nada muda', async () => {
    const repo = createMemoryRepository();
    const a = await criarBloco(repo, base, 1);
    await criarBloco(repo, { ...base, weekday: 1 }, 2);
    if (!a.ok) throw new Error('x');
    const m = await moverBloco(repo, a.value.id, 1, 545, 3);
    expect(m.ok).toBe(false);
    expect((await repo.listBlocks()).find((b) => b.id === a.value.id)?.weekday).toBe(0);
  });
  it('encurtar com desfazer; não aceita duração maior ou inválida', async () => {
    const repo = createMemoryRepository();
    const b = await criarBloco(repo, { ...base, durationMinutes: 50 }, 1);
    if (!b.ok) throw new Error('x');
    expect((await encurtarBloco(repo, b.value.id, 60, 2)).ok).toBe(false);
    expect((await encurtarBloco(repo, b.value.id, 3, 2)).ok).toBe(false);
    const e = await encurtarBloco(repo, b.value.id, 40, 2);
    if (!e.ok) throw new Error('x');
    expect((await repo.listBlocks())[0].durationMinutes).toBe(40);
    await desfazerBloco(repo, e.value.undo, 3);
    expect((await repo.listBlocks())[0].durationMinutes).toBe(50);
  });
  it('bloco inexistente', async () => {
    const repo = createMemoryRepository();
    const m = await moverBloco(repo, 'nope', 1, 1, 1);
    expect(!m.ok && m.error.code).toBe('bloco_inexistente');
  });
  it('remover bloco mantém as sessões', async () => {
    const repo = createMemoryRepository();
    const b = await criarBloco(repo, base, 1);
    if (!b.ok) throw new Error('x');
    await repo.saveSession({ ...endedSession(sp(2026, 11, 9, 9), 25, 'concluida'), blockId: b.value.id });
    await removerBloco(repo, b.value.id);
    expect(await repo.listBlocks()).toHaveLength(0);
    expect(await repo.listSessions()).toHaveLength(1);
  });
  it('concluir bloco de descanso cria RestDay; foco não', async () => {
    const repo = createMemoryRepository();
    const r = await criarBloco(repo, { ...base, kind: 'descanso' }, 1);
    const f = await criarBloco(repo, { ...base, weekday: 1 }, 2);
    if (!r.ok || !f.ok) throw new Error('x');
    expect((await concluirBloco(repo, f.value.id, '2026-11-10')).ok).toBe(true);
    expect(await repo.listRestDays()).toHaveLength(0);
    await concluirBloco(repo, r.value.id, '2026-11-09');
    await concluirBloco(repo, r.value.id, '2026-11-09');
    expect(await repo.listRestDays()).toEqual([{ date: '2026-11-09' }]);
  });
  it('plano inicial usa as escritas em lote quando o repositório as tem (2 chamadas)', async () => {
    const memoria = createMemoryRepository();
    const calls: string[] = [];
    const repo = {
      ...memoria,
      saveBlock: () => Promise.reject(new Error('item a item')),
      saveHabit: () => Promise.reject(new Error('item a item')),
      saveBlocks: async (blocks: readonly RoutineBlock[]) => {
        calls.push(`blocos:${blocks.length}`);
        for (const b of blocks) await memoria.saveBlock(b);
      },
      saveHabits: async (habits: readonly Habit[]) => {
        calls.push(`habitos:${habits.length}`);
        for (const h of habits) await memoria.saveHabit(h);
      },
    };
    const plan = await criarPlanoInicial(repo, 5);
    expect(calls.sort()).toEqual([`blocos:${plan.blocks.length}`, 'habitos:2']);
    expect(await memoria.listBlocks()).toHaveLength(plan.blocks.length);
  });
  it('plano inicial grava blocos válidos e dois hábitos', async () => {
    const repo = createMemoryRepository();
    const plan = await criarPlanoInicial(repo, 5);
    expect(plan.habits).toHaveLength(2);
    expect(await repo.listBlocks()).toHaveLength(plan.blocks.length);
    expect(plan.blocks.filter((b) => b.weekday === 0)).toHaveLength(3);
  });
});
