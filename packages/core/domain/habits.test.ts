import { createMemoryRepository } from '../data/memory-repository';
import { HABITS } from '../config/decisions';
import { addDays } from './day';
import { criarHabito, desmarcarHabito, editarHabito, habitsForDate, marcarHabito, validarDiaDoRegistro } from './habits';
import { sp, TZ } from './test-utils';
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
    const agora = sp(2026, 11, 11);
    await marcarHabito(repo, h.value.id, '2026-11-10', agora);
    const again = await marcarHabito(repo, h.value.id, '2026-11-10', agora + 100);
    expect(again.ok && again.value.doneAt).toBe(agora);
    expect(await repo.listHabitLogs()).toHaveLength(1);
    await marcarHabito(repo, h.value.id, '2026-11-11', agora + 200);
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
    const edited = await editarHabito(repo, h.value.id, { state: 'pausado' });
    expect(edited.ok && edited.value.state).toBe('pausado');
  });
});

describe('dia do registro', () => {
  const habit = { weekdays: ALL, state: 'ativo' as const };
  // Quarta, 18/11, ao meio dia.
  const base = { habit, now: sp(2026, 11, 18), timeZone: TZ, dayStartMinutes: 7 * 60 };
  const codigo = (extra: Partial<Parameters<typeof validarDiaDoRegistro>[0]> & { date: string }) => {
    const r = validarDiaDoRegistro({ ...base, ...extra });
    return r.ok ? 'ok' : r.error.code;
  };

  it('aceita de hoje até a janela, nunca o futuro nem antes dela', () => {
    expect(codigo({ date: '2026-11-18' })).toBe('ok');
    expect(codigo({ date: addDays('2026-11-18', -HABITS.registroMaxDiasAtras) })).toBe('ok');
    expect(codigo({ date: addDays('2026-11-18', -HABITS.registroMaxDiasAtras - 1) })).toBe('data_antiga');
    expect(codigo({ date: '2026-11-19' })).toBe('data_no_futuro');
  });

  it('o dia segue o fuso e a virada: de madrugada o dia seguinte ainda não chegou', () => {
    const madrugada = sp(2026, 11, 18, 3);
    expect(codigo({ date: '2026-11-17', now: madrugada })).toBe('ok');
    expect(codigo({ date: '2026-11-18', now: madrugada })).toBe('data_no_futuro');
    // Entre a virada do app (4h) e o começo do dia da pessoa (7h), o dia do app já vale.
    expect(codigo({ date: '2026-11-18', now: sp(2026, 11, 18, 5) })).toBe('ok');
  });

  it('nada antes de o hábito existir, nem arquivado, nem fora da frequência', () => {
    const createdAt = sp(2026, 11, 17);
    expect(codigo({ date: '2026-11-17', createdAt })).toBe('ok');
    expect(codigo({ date: '2026-11-16', createdAt })).toBe('data_antes_do_habito');
    expect(codigo({ date: '2026-11-18', habit: { ...habit, state: 'arquivado' } })).toBe('habito_arquivado');
    expect(codigo({ date: '2026-11-18', habit: { ...habit, weekdays: [0] } })).toBe('dia_fora_do_habito');
  });

  it('marcarHabito usa a mesma regra', async () => {
    const repo = createMemoryRepository();
    const h = await criarHabito(repo, { title: 'x', weekdays: ALL }, 1);
    if (!h.ok) throw new Error('x');
    const r = await marcarHabito(repo, h.value.id, '2026-11-19', sp(2026, 11, 18));
    expect(!r.ok && r.error.code).toBe('data_no_futuro');
    expect(await repo.listHabitLogs()).toEqual([]);
  });
});
