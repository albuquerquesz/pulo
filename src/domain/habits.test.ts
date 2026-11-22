import { createMemoryRepository } from '@/data/memory-repository';
import { criarHabito, desmarcarHabito, editarHabito, habitsForDate, marcarHabito } from './habits';
import type { Weekday } from './types';

const ALL: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

describe('hábitos', () => {
  it('aceita até 5 por dia e recusa o sexto', async () => {
    const repo = createMemoryRepository();
    for (let i = 0; i < 5; i += 1) {
      expect((await criarHabito(repo, { title: `h${i}`, weekdays: [0] }, i)).ok).toBe(true);
    }
    const sixth = await criarHabito(repo, { title: 'extra', weekdays: [0, 1] }, 9);
    expect(sixth.ok).toBe(false);
    if (!sixth.ok) expect(sixth.error.code).toBe('limite_por_dia');
    expect((await criarHabito(repo, { title: 'extra', weekdays: [1] }, 10)).ok).toBe(true);
  });
  it('recusa título vazio e sem dias', async () => {
    const repo = createMemoryRepository();
    expect((await criarHabito(repo, { title: '  ', weekdays: ALL }, 1)).ok).toBe(false);
    expect((await criarHabito(repo, { title: 'x', weekdays: [] }, 1)).ok).toBe(false);
  });
  it('marcar duas vezes no dia mantém um registro', async () => {
    const repo = createMemoryRepository();
    const h = await criarHabito(repo, { title: 'Água', weekdays: ALL }, 1);
    if (!h.ok) throw new Error('x');
    await marcarHabito(repo, h.value.id, '2026-11-10', 100);
    const again = await marcarHabito(repo, h.value.id, '2026-11-10', 200);
    expect(again.ok && again.value.doneAt).toBe(100);
    expect(await repo.listHabitLogs()).toHaveLength(1);
    await marcarHabito(repo, h.value.id, '2026-11-11', 300);
    expect(await repo.listHabitLogs()).toHaveLength(2);
    await desmarcarHabito(repo, h.value.id, '2026-11-10');
    expect(await repo.listHabitLogs()).toHaveLength(1);
  });
  it('hábito inexistente e habitsForDate', async () => {
    const repo = createMemoryRepository();
    expect((await marcarHabito(repo, 'nope', '2026-11-10', 1)).ok).toBe(false);
    const h = await criarHabito(repo, { title: 'Seg', weekdays: [0] }, 1);
    if (!h.ok) throw new Error('x');
    expect(habitsForDate([h.value], '2026-11-09')).toHaveLength(1); // segunda
    expect(habitsForDate([h.value], '2026-11-10')).toHaveLength(0);
    const edited = await editarHabito(repo, h.value.id, { active: false });
    expect(edited.ok && edited.value.active).toBe(false);
  });
});
