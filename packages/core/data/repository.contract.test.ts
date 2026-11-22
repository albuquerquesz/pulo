import { endedSession, sp } from '../domain/test-utils';
import type { Repository, User } from '../domain/types';
import { createMemoryRepository } from './memory-repository';
import { createMemoryAdapter, createStorageRepository, STORAGE_KEY } from './storage';

const user: User = {
  id: 'u1',
  frogName: 'Pulo',
  timezone: 'America/Sao_Paulo',
  dayStartMinutes: 420,
  dayEndMinutes: 1320,
  theme: 'sistema',
  reduceMotion: false,
  createdAt: 1,
};

const factories: [string, () => Repository][] = [
  ['memória', () => createMemoryRepository()],
  ['armazenamento (chave e valor)', () => createStorageRepository(createMemoryAdapter())],
];

describe.each(factories)('contrato do Repository: %s', (_name, make) => {
  it('começa vazio', async () => {
    const r = make();
    expect(await r.getUser()).toBeNull();
    expect(await r.listBlocks()).toEqual([]);
    expect(await r.listSessions()).toEqual([]);
    expect(await r.getMascotState()).toBeNull();
  });

  it('usuário e blocos: salvar, atualizar por id e apagar', async () => {
    const r = make();
    await r.saveUser(user);
    expect(await r.getUser()).toEqual(user);
    const b = { id: 'b1', weekday: 0 as const, startMinutes: 540, durationMinutes: 25, kind: 'foco' as const };
    await r.saveBlock(b);
    await r.saveBlock({ ...b, durationMinutes: 30 });
    expect(await r.listBlocks()).toEqual([{ ...b, durationMinutes: 30 }]);
    await r.deleteBlock('b1');
    expect(await r.listBlocks()).toEqual([]);
  });

  it('não vaza referências: mudar o retornado não muda o guardado', async () => {
    const r = make();
    await r.saveUser(user);
    const got = (await r.getUser())!;
    got.frogName = 'Outro';
    expect((await r.getUser())!.frogName).toBe('Pulo');
  });

  it('registros de hábito: um por hábito e dia, filtro por intervalo, apagar', async () => {
    const r = make();
    await r.saveHabitLog({ habitId: 'h', date: '2026-11-10', doneAt: 1 });
    await r.saveHabitLog({ habitId: 'h', date: '2026-11-10', doneAt: 2 });
    await r.saveHabitLog({ habitId: 'h', date: '2026-11-12', doneAt: 3 });
    expect(await r.listHabitLogs()).toHaveLength(2);
    expect(await r.listHabitLogs({ from: '2026-11-11', to: '2026-11-30' })).toHaveLength(1);
    await r.deleteHabitLog('h', '2026-11-10');
    expect(await r.listHabitLogs()).toHaveLength(1);
  });

  it('apagar hábito apaga os registros dele', async () => {
    const r = make();
    await r.saveHabit({ id: 'h', title: 'x', weekdays: [0], active: true });
    await r.saveHabitLog({ habitId: 'h', date: '2026-11-10', doneAt: 1 });
    await r.deleteHabit('h');
    expect(await r.listHabits()).toEqual([]);
    expect(await r.listHabitLogs()).toEqual([]);
  });

  it('sessões: em andamento pode mudar, encerrada é imutável', async () => {
    const r = make();
    const running = { id: 's', startedAt: 1, plannedMinutes: 25, state: 'em_andamento' as const, pausedMs: 0 };
    await r.saveSession(running);
    await r.saveSession({ ...running, pausedSince: 5 });
    const ended = { ...running, state: 'concluida' as const, endedAt: 99 };
    await r.saveSession(ended);
    await expect(r.saveSession({ ...ended, state: 'interrompida' })).rejects.toThrow();
    expect(await r.listSessions()).toEqual([ended]);
    // a fila de escrita continua funcionando depois do erro
    await r.saveSession(endedSession(sp(2026, 11, 10), 25, 'concluida'));
    expect(await r.listSessions()).toHaveLength(2);
  });

  it('check ins, descanso, propostas e estado do mascote', async () => {
    const r = make();
    await r.saveCheckIn({ id: 'c', date: '2026-11-10', period: 'manha', energy: 3, createdAt: 1 });
    await r.saveCheckIn({ id: 'c', date: '2026-11-10', period: 'manha', energy: 4, createdAt: 2 });
    await r.saveCheckIn({ id: 'd', date: '2026-11-11', period: 'tarde', energy: 2, createdAt: 3 });
    expect(await r.listCheckIns()).toHaveLength(2);
    expect(await r.listCheckIns({ from: '2026-11-11', to: '2026-11-11' })).toHaveLength(1);
    await r.saveRestDay({ date: '2026-11-10' });
    await r.saveRestDay({ date: '2026-11-10' });
    expect(await r.listRestDays()).toHaveLength(1);
    await r.deleteRestDay('2026-11-10');
    expect(await r.listRestDays()).toEqual([]);
    const p = {
      id: 'p', weekStart: '2026-11-09', state: 'pendente' as const, patternText: 'x', changes: [],
      origin: 'regra' as const, createdAt: 1,
    };
    await r.saveProposal(p);
    await r.saveProposal({ ...p, state: 'aceita' });
    expect((await r.listProposals())[0].state).toBe('aceita');
    await r.saveMascotState({ phase: 2, careDays: 4, updatedAt: 9 });
    expect(await r.getMascotState()).toEqual({ phase: 2, careDays: 4, updatedAt: 9 });
  });

  it('escritas concorrentes não se perdem', async () => {
    const r = make();
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => r.saveHabitLog({ habitId: 'h', date: `2026-11-${String(i + 1).padStart(2, '0')}`, doneAt: i })),
    );
    expect(await r.listHabitLogs()).toHaveLength(20);
  });

  it('clearAll zera tudo, inclusive sessões e mascote', async () => {
    const r = make();
    await r.saveUser(user);
    await r.saveBlock({ id: 'b', weekday: 1, startMinutes: 0, durationMinutes: 5, kind: 'descanso' });
    await r.saveHabit({ id: 'h', title: 'x', weekdays: [0], active: true });
    await r.saveHabitLog({ habitId: 'h', date: '2026-11-10', doneAt: 1 });
    await r.saveSession(endedSession(1, 25, 'concluida'));
    await r.saveCheckIn({ id: 'c', date: '2026-11-10', period: 'manha', energy: 3, createdAt: 1 });
    await r.saveRestDay({ date: '2026-11-10' });
    await r.saveProposal({ id: 'p', weekStart: 'x', state: 'pendente', patternText: '', changes: [], origin: 'ia', createdAt: 1 });
    await r.saveMascotState({ phase: 3, careDays: 9, updatedAt: 1 });
    await r.clearAll();
    expect(await r.getUser()).toBeNull();
    expect(await r.listBlocks()).toEqual([]);
    expect(await r.listHabits()).toEqual([]);
    expect(await r.listHabitLogs()).toEqual([]);
    expect(await r.listSessions()).toEqual([]);
    expect(await r.listCheckIns()).toEqual([]);
    expect(await r.listRestDays()).toEqual([]);
    expect(await r.listProposals()).toEqual([]);
    expect(await r.getMascotState()).toBeNull();
  });
});

describe('repositório sobre armazenamento', () => {
  it('persiste em JSON e outro repositório no mesmo adaptador lê o mesmo', async () => {
    const adapter = createMemoryAdapter();
    await createStorageRepository(adapter).saveUser(user);
    expect(JSON.parse((await adapter.getItem(STORAGE_KEY))!).user.frogName).toBe('Pulo');
    expect(await createStorageRepository(adapter).getUser()).toEqual(user);
  });
  it('JSON corrompido ou de outra versão vira banco vazio, sem quebrar', async () => {
    const adapter = createMemoryAdapter({ [STORAGE_KEY]: '{nao e json' });
    expect(await createStorageRepository(adapter).listBlocks()).toEqual([]);
    await adapter.setItem(STORAGE_KEY, JSON.stringify({ version: 99 }));
    expect(await createStorageRepository(adapter).getUser()).toBeNull();
  });
});
