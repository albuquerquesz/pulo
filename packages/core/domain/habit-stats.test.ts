import { describe, expect, it } from 'vitest';

import { HABITS } from '../config/decisions';
import { computeHabitStats, statsDoHabito } from './habit-stats';
import { criarHabito, editarHabito, habitsForDate, resolveHabitState } from './habits';
import { createMemoryRepository } from '../data/memory-repository';
import type { DateKey, Weekday } from './types';

// 2026-11-16 é segunda.
const SEG_A_SEX: Weekday[] = [0, 1, 2, 3, 4];
const logs = (...dates: DateKey[]) => dates.map((date) => ({ date }));
const dia = (stats: ReturnType<typeof statsDoHabito>, date: DateKey) => stats.calendario.flat().find((d) => d.date === date)?.estado;

describe('statsDoHabito', () => {
  it('de segunda a sexta: o fim de semana não conta nem quebra', () => {
    const s = statsDoHabito({ weekdays: SEG_A_SEX }, logs('2026-11-12', '2026-11-13', '2026-11-16'), [], '2026-11-17');
    expect(s).toMatchObject({ sequencia: 3, recorde: 3, taxa: 1, total: 3 });
    expect(dia(s, '2026-11-14')).toBe('fora');
    expect(dia(s, '2026-11-17')).toBe('vazio');
    expect(dia(s, '2026-11-18')).toBe('futuro');
  });

  it('dia da frequência perdido quebra a sequência e baixa a taxa; o recorde fica', () => {
    const s = statsDoHabito({ weekdays: SEG_A_SEX }, logs('2026-11-09', '2026-11-10', '2026-11-12'), [], '2026-11-13');
    expect(s).toMatchObject({ sequencia: 1, recorde: 2, taxa: 0.75, total: 3 });
  });

  it('descanso aparece diferente, não quebra e não entra na taxa; feito vence o descanso', () => {
    const rest = [{ date: '2026-11-10' }, { date: '2026-11-11' }];
    const s = statsDoHabito({ weekdays: SEG_A_SEX }, logs('2026-11-09', '2026-11-11'), rest, '2026-11-11');
    expect(s).toMatchObject({ sequencia: 2, taxa: 1 });
    expect(dia(s, '2026-11-10')).toBe('descanso');
    expect(dia(s, '2026-11-11')).toBe('feito');
  });

  it('histórico vazio', () => {
    const s = statsDoHabito({ weekdays: SEG_A_SEX }, [], [], '2026-11-17');
    expect(s).toMatchObject({ sequencia: 0, recorde: 0, taxa: null, total: 0 });
    expect(s.calendario).toHaveLength(HABITS.statsWeeks);
    expect(s.calendario.every((semana) => semana.length === 7)).toBe(true);
    expect(dia(s, '2026-11-16')).toBe('fora');
  });

  it('criado no meio da janela: antes é fora, depois sem registro é vazio', () => {
    const s = statsDoHabito({ weekdays: SEG_A_SEX, criadoEm: '2026-11-11' }, logs('2026-11-12'), [], '2026-11-13');
    expect(dia(s, '2026-11-10')).toBe('fora');
    expect(dia(s, '2026-11-11')).toBe('vazio');
    expect(s.taxa).toBe(0.5);
  });

  it('registro anterior à criação puxa o começo; fora da frequência soma sem entrar na taxa; futuro é ignorado', () => {
    const s = statsDoHabito({ weekdays: [0], criadoEm: '2026-11-16' }, logs('2026-11-14', '2026-11-16', '2026-12-30'), [], '2026-11-16');
    expect(s).toMatchObject({ sequencia: 2, total: 2, taxa: 1 });
    expect(dia(s, '2026-11-14')).toBe('feito');
  });

  it('férias contam como descanso', () => {
    const s = computeHabitStats({
      habito: { weekdays: SEG_A_SEX },
      logs: logs('2026-11-09'),
      restDays: [],
      vacation: { ligado: false, desde: null, periodos: [{ de: '2026-11-10', ate: '2026-11-13' }] },
      timeZone: 'UTC',
      now: Date.parse('2026-11-16T12:00:00Z'),
    });
    expect(s).toMatchObject({ sequencia: 1, taxa: 1 });
  });
});

describe('estado e apresentação do hábito', () => {
  it('state vence; o active antigo não desfaz pausa nem arquivo', () => {
    expect(resolveHabitState({ state: 'pausado', active: true }, 'ativo')).toBe('pausado');
    expect(resolveHabitState({}, 'pausado')).toBe('pausado');
    expect(resolveHabitState({})).toBe('ativo');
    expect(resolveHabitState({ active: false }, 'ativo')).toBe('arquivado');
    expect(resolveHabitState({ active: false }, 'pausado')).toBe('pausado');
    expect(resolveHabitState({ active: true }, 'arquivado')).toBe('ativo');
  });

  it('pausar tira do Hoje; editar guarda e tira os campos; sem horário o lembrete fica desligado', async () => {
    const repo = createMemoryRepository();
    const criado = await criarHabito(repo, { title: 'Ler', weekdays: [0], icon: '📚', period: 'noite', reminderOn: true }, 1);
    if (!criado.ok) throw new Error(criado.error.message);
    expect(criado.value).not.toHaveProperty('reminderOn');
    const { id } = criado.value;
    const ligado = await editarHabito(repo, id, { reminderMinutes: 1200, reminderOn: true, state: 'pausado' });
    expect(ligado.ok && ligado.value).toMatchObject({ icon: '📚', period: 'noite', reminderMinutes: 1200, reminderOn: true });
    expect(habitsForDate(await repo.listHabits(), '2026-11-16')).toEqual([]);
    const limpo = await editarHabito(repo, id, { icon: null, period: null, reminderOn: false, state: 'ativo' });
    expect(limpo.ok && limpo.value).toEqual({ id, title: 'Ler', weekdays: [0], state: 'ativo', reminderMinutes: 1200 });
  });
});
