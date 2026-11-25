import type {
  FocusSession,
  Goal,
  Habit,
  HabitLog,
  IslandPurchase,
  MascotState,
  RestDay,
  RoutineBlock,
  WeeklyProposal,
} from '@pulo/core/domain/types';
import { describe, expect, it } from 'vitest';
import type {
  FocusSession as FocusSessionRow,
  Goal as GoalRow,
  Habit as HabitRow,
  HabitLog as HabitLogRow,
  IslandPurchase as IslandPurchaseRow,
  MascotState as MascotStateRow,
  RestDay as RestDayRow,
  RoutineBlock as RoutineBlockRow,
  WeeklyProposal as WeeklyProposalRow,
} from '#client';
import { dateKeyToDate, dateToDateKey } from './dates';
import {
  focusSessionMapper,
  goalMapper,
  habitLogMapper,
  habitMapper,
  islandPurchaseMapper,
  mascotStateMapper,
  restDayMapper,
  routineBlockMapper,
  toPhase,
  toWeekday,
  weeklyProposalMapper,
} from './mappers';

const USER = 'user-1';

describe('datas', () => {
  it('converte DateKey e Date de ida e volta, em UTC', () => {
    const date = dateKeyToDate('2026-11-23');
    expect(date.toISOString()).toBe('2026-11-23T00:00:00.000Z');
    expect(dateToDateKey(date)).toBe('2026-11-23');
  });

  it('recusa DateKey malformada ou inexistente', () => {
    expect(() => dateKeyToDate('23/11/2026')).toThrow(RangeError);
    expect(() => dateKeyToDate('2026-02-31')).toThrow(RangeError);
  });
});

describe('guardas', () => {
  it('aceitam o intervalo do domínio e recusam o resto', () => {
    expect(toWeekday(6)).toBe(6);
    expect(() => toWeekday(7)).toThrow(RangeError);
    expect(toPhase(4)).toBe(4);
    expect(() => toPhase(5)).toThrow(RangeError);
  });
});

describe('mapeadores', () => {
  it('RoutineBlock, com e sem título', () => {
    const block: RoutineBlock = { id: 'b1', weekday: 2, startMinutes: 540, durationMinutes: 25, kind: 'foco', title: 'Estudar' };
    const row: RoutineBlockRow = { id: 'b1', userId: USER, weekday: 2, startMinutes: 540, durationMinutes: 25, kind: 'foco', title: 'Estudar' };
    expect(routineBlockMapper.fromDomain(USER, block)).toStrictEqual(row);
    expect(routineBlockMapper.toDomain(row)).toStrictEqual(block);

    const semTitulo: RoutineBlock = { id: 'b2', weekday: 0, startMinutes: 60, durationMinutes: 5, kind: 'descanso' };
    const rowSemTitulo: RoutineBlockRow = { ...row, id: 'b2', weekday: 0, startMinutes: 60, durationMinutes: 5, kind: 'descanso', title: null };
    expect(routineBlockMapper.fromDomain(USER, semTitulo)).toStrictEqual(rowSemTitulo);
    expect(routineBlockMapper.toDomain(rowSemTitulo)).toStrictEqual(semTitulo);
  });

  it('Habit', () => {
    const habit: Habit = { id: 'h1', title: 'Alongar', weekdays: [0, 2, 4], active: true };
    const row: HabitRow = { id: 'h1', userId: USER, title: 'Alongar', weekdays: [0, 2, 4], active: true, goalId: null };
    const { goalId, ...semMeta } = row;
    expect(goalId).toBeNull();
    expect(habitMapper.fromDomain(USER, habit)).toStrictEqual(semMeta);
    expect(habitMapper.toDomain(row)).toStrictEqual(habit);
    expect(habitMapper.toDomain({ ...row, goalId: 'g1' })).toStrictEqual({ ...habit, goalId: 'g1' });
    expect(habitMapper.fromDomain(USER, { ...habit, goalId: null })).toStrictEqual(row);
  });

  it('HabitLog', () => {
    const log: HabitLog = { habitId: 'h1', date: '2026-11-22', doneAt: 1_795_000_000_000 };
    const row: HabitLogRow = { habitId: 'h1', userId: USER, date: new Date('2026-11-22T00:00:00.000Z'), doneAt: new Date(1_795_000_000_000) };
    expect(habitLogMapper.fromDomain(USER, log)).toStrictEqual(row);
    expect(habitLogMapper.toDomain(row)).toStrictEqual(log);
  });

  it('FocusSession em andamento (pausada) e encerrada', () => {
    const running: FocusSession = { id: 's1', startedAt: 1000, plannedMinutes: 25, state: 'em_andamento', pausedMs: 5000, pausedSince: 9000 };
    const runningRow: FocusSessionRow = {
      id: 's1', userId: USER, blockId: null, startedAt: new Date(1000), endedAt: null,
      plannedMinutes: 25, state: 'em_andamento', pausedMs: 5000, pausedSince: new Date(9000),
    };
    const done: FocusSession = { id: 's2', blockId: 'b1', startedAt: 1000, endedAt: 2_000_000, plannedMinutes: 25, state: 'concluida', pausedMs: 0 };
    const doneRow: FocusSessionRow = {
      id: 's2', userId: USER, blockId: 'b1', startedAt: new Date(1000), endedAt: new Date(2_000_000),
      plannedMinutes: 25, state: 'concluida', pausedMs: 0, pausedSince: null,
    };
    expect(focusSessionMapper.fromDomain(USER, running)).toStrictEqual(runningRow);
    expect(focusSessionMapper.toDomain(runningRow)).toStrictEqual(running);
    expect(focusSessionMapper.fromDomain(USER, done)).toStrictEqual(doneRow);
    expect(focusSessionMapper.toDomain(doneRow)).toStrictEqual(done);
  });

  it('RestDay', () => {
    const restDay: RestDay = { date: '2026-11-21' };
    const row: RestDayRow = { userId: USER, date: new Date('2026-11-21T00:00:00.000Z') };
    expect(restDayMapper.fromDomain(USER, restDay)).toStrictEqual(row);
    expect(restDayMapper.toDomain(row)).toStrictEqual(restDay);
  });

  it('WeeklyProposal valida o Json das mudanças', () => {
    const slotFrom = { weekday: 1, startMinutes: 900, durationMinutes: 25 };
    const slotTo = { weekday: 1, startMinutes: 540, durationMinutes: 25 };
    const proposal: WeeklyProposal = {
      id: 'p1',
      weekStart: '2026-11-23',
      state: 'pendente',
      patternText: 'Você rende mais de manhã.',
      changes: [{ kind: 'mover_foco', blockId: 'b1', from: { ...slotFrom, weekday: 1 }, to: { ...slotTo, weekday: 1 } }],
      origin: 'regra',
      createdAt: 99,
    };
    const row: WeeklyProposalRow = {
      id: 'p1',
      userId: USER,
      weekStart: new Date('2026-11-23T00:00:00.000Z'),
      state: 'pendente',
      patternText: 'Você rende mais de manhã.',
      reasonText: null,
      changes: [{ kind: 'mover_foco', blockId: 'b1', from: slotFrom, to: slotTo }],
      origin: 'regra',
      createdAt: new Date(99),
      decidedAt: null,
    };
    expect(weeklyProposalMapper.fromDomain(USER, proposal)).toStrictEqual(row);
    expect(weeklyProposalMapper.toDomain(row)).toStrictEqual(proposal);
    expect(() => weeklyProposalMapper.toDomain({ ...row, changes: [{ kind: 'apagar' }] })).toThrow();
    expect(() => weeklyProposalMapper.toDomain({ ...row, changes: 'texto' })).toThrow();
  });

  it('Goal, com e sem os opcionais, valida o Json dos marcos', () => {
    const goal: Goal = {
      id: 'g1',
      title: 'Maratona',
      why: 'saúde',
      targetDate: '2027-06-01',
      state: 'concluida',
      milestones: [{ id: 'm1', title: '5 km', doneAt: 3 }, { id: 'm2', title: '10 km' }],
      createdAt: 1,
      completedAt: 9,
      icon: '🏃',
      color: 'foco',
    };
    const row: GoalRow = {
      id: 'g1',
      userId: USER,
      title: 'Maratona',
      why: 'saúde',
      targetDate: new Date('2027-06-01T00:00:00.000Z'),
      state: 'concluida',
      milestones: [{ id: 'm1', title: '5 km', doneAt: 3 }, { id: 'm2', title: '10 km' }],
      createdAt: new Date(1),
      completedAt: new Date(9),
      icon: '🏃',
      color: 'foco',
    };
    expect(goalMapper.fromDomain(USER, goal)).toStrictEqual(row);
    expect(goalMapper.toDomain(row)).toStrictEqual(goal);

    const simples: Goal = { id: 'g2', title: 'x', state: 'ativa', milestones: [], createdAt: 1 };
    const simplesRow: GoalRow = { ...row, id: 'g2', title: 'x', why: null, targetDate: null, state: 'ativa', milestones: [], completedAt: null, icon: null, color: null };
    expect(goalMapper.toDomain(simplesRow)).toStrictEqual(simples);
    expect(() => goalMapper.toDomain({ ...row, milestones: [{ title: 'sem id' }] })).toThrow();
  });

  it('IslandPurchase', () => {
    const purchase: IslandPurchase = { item: 'banco', cost: 8, createdAt: 42 };
    const row: IslandPurchaseRow = { userId: USER, item: 'banco', kind: 'antiga', cost: 8, createdAt: new Date(42) };
    const { kind, ...semKind } = row;
    expect(kind).toBe('antiga');
    expect(islandPurchaseMapper.fromDomain(USER, purchase)).toStrictEqual(semKind);
    expect(islandPurchaseMapper.toDomain(row)).toStrictEqual(purchase);
  });

  it('MascotState', () => {
    const state: MascotState = { phase: 3, careDays: 9, updatedAt: 55 };
    const row: MascotStateRow = { userId: USER, phase: 3, careDays: 9, updatedAt: new Date(55) };
    expect(mascotStateMapper.fromDomain(USER, state)).toStrictEqual(row);
    expect(mascotStateMapper.toDomain(row)).toStrictEqual(state);
  });
});
