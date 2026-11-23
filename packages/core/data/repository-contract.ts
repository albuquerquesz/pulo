// Suíte de contrato do `Repository`, reutilizável por qualquer implementação (memória, armazenamento,
// cliente remoto). Usa `describe`, `it` e `expect` globais: roda no Jest do core e no Vitest (`globals: true`).
import { endedSession, sp } from '../domain/test-utils';
import type { Repository, User } from '../domain/types';

/** O que cada teste recebe: um repositório vazio e o id que o `User` desse repositório precisa ter. */
export interface RepositoryUnderTest {
  repository: Repository;
  /** Id do usuário dono do repositório (no remoto é o id da conta). */
  userId: string;
}

export interface ContractOptions {
  /**
   * O repositório não grava o estado do sapo de verdade: quem calcula é o servidor
   * (`saveMascotState` só atualiza o cache). Pula a checagem de ida e volta.
   */
  mascotIsServerDerived?: boolean;
}

const baseUser: User = {
  id: 'u1',
  frogName: 'Pulo',
  timezone: 'America/Sao_Paulo',
  dayStartMinutes: 420,
  dayEndMinutes: 1320,
  theme: 'sistema',
  reduceMotion: false,
  createdAt: 1,
};

// Ids únicos por execução: o servidor nunca deixa duas pessoas usarem o mesmo id.
const runTag = Math.random().toString(36).slice(2, 8);
let seq = 0;
const uid = (prefix: string) => `${prefix}-${runTag}-${(seq += 1)}`;

export function defineRepositoryContract(
  name: string,
  make: () => RepositoryUnderTest | Promise<RepositoryUnderTest>,
  options: ContractOptions = {},
): void {
  const subject = async () => {
    const { repository, userId } = await make();
    return { r: repository, user: { ...baseUser, id: userId } };
  };

  describe(`contrato do Repository: ${name}`, () => {
    it('começa vazio', async () => {
      const { r } = await subject();
      expect(await r.getUser()).toBeNull();
      expect(await r.listBlocks()).toEqual([]);
      expect(await r.listSessions()).toEqual([]);
      expect(await r.getMascotState()).toBeNull();
    });

    it('usuário e blocos: salvar, atualizar por id e apagar', async () => {
      const { r, user } = await subject();
      await r.saveUser(user);
      expect(await r.getUser()).toEqual(user);
      const b = { id: uid('b'), weekday: 0 as const, startMinutes: 540, durationMinutes: 25, kind: 'foco' as const };
      await r.saveBlock(b);
      await r.saveBlock({ ...b, durationMinutes: 30 });
      expect(await r.listBlocks()).toEqual([{ ...b, durationMinutes: 30 }]);
      await r.deleteBlock(b.id);
      expect(await r.listBlocks()).toEqual([]);
    });

    it('não vaza referências: mudar o retornado não muda o guardado', async () => {
      const { r, user } = await subject();
      await r.saveUser(user);
      const got = (await r.getUser())!;
      got.frogName = 'Outro';
      expect((await r.getUser())!.frogName).toBe('Pulo');
      const block = { id: uid('b'), weekday: 2 as const, startMinutes: 60, durationMinutes: 10, kind: 'foco' as const };
      await r.saveBlock(block);
      (await r.listBlocks())[0].durationMinutes = 99;
      expect((await r.listBlocks())[0].durationMinutes).toBe(10);
    });

    it('registros de hábito: um por hábito e dia, filtro por intervalo, apagar', async () => {
      const { r } = await subject();
      const h = uid('h');
      await r.saveHabit({ id: h, title: 'x', weekdays: [0], active: true });
      await r.saveHabitLog({ habitId: h, date: '2026-11-10', doneAt: 1 });
      await r.saveHabitLog({ habitId: h, date: '2026-11-10', doneAt: 2 });
      await r.saveHabitLog({ habitId: h, date: '2026-11-12', doneAt: 3 });
      expect(await r.listHabitLogs()).toHaveLength(2);
      expect(await r.listHabitLogs({ from: '2026-11-11', to: '2026-11-30' })).toHaveLength(1);
      await r.deleteHabitLog(h, '2026-11-10');
      expect(await r.listHabitLogs()).toHaveLength(1);
    });

    it('apagar hábito apaga os registros dele', async () => {
      const { r } = await subject();
      const h = uid('h');
      await r.saveHabit({ id: h, title: 'x', weekdays: [0], active: true });
      await r.saveHabitLog({ habitId: h, date: '2026-11-10', doneAt: 1 });
      await r.deleteHabit(h);
      expect(await r.listHabits()).toEqual([]);
      expect(await r.listHabitLogs()).toEqual([]);
    });

    it('sessões: em andamento pode mudar, encerrada é imutável', async () => {
      const { r } = await subject();
      const running = { id: uid('s'), startedAt: 1, plannedMinutes: 25, state: 'em_andamento' as const, pausedMs: 0 };
      await r.saveSession(running);
      await r.saveSession({ ...running, pausedSince: 5 });
      const ended = { ...running, state: 'concluida' as const, endedAt: 99 };
      await r.saveSession(ended);
      await expect(r.saveSession({ ...ended, state: 'interrompida' })).rejects.toThrow();
      expect(await r.listSessions()).toEqual([ended]);
      // a fila de escrita continua funcionando depois do erro
      await r.saveSession({ ...endedSession(sp(2026, 11, 10), 25, 'concluida'), id: uid('s') });
      expect(await r.listSessions()).toHaveLength(2);
    });

    it('descanso, propostas e estado do mascote', async () => {
      const { r } = await subject();
      await r.saveRestDay({ date: '2026-11-10' });
      await r.saveRestDay({ date: '2026-11-10' });
      expect(await r.listRestDays()).toHaveLength(1);
      await r.deleteRestDay('2026-11-10');
      expect(await r.listRestDays()).toEqual([]);
      const p = {
        id: uid('p'), weekStart: '2026-11-09', state: 'pendente' as const, patternText: 'x', changes: [],
        origin: 'regra' as const, createdAt: 1,
      };
      await r.saveProposal(p);
      await r.saveProposal({ ...p, state: 'aceita', decidedAt: 2 });
      expect((await r.listProposals())[0].state).toBe('aceita');
      if (!options.mascotIsServerDerived) {
        await r.saveMascotState({ phase: 2, careDays: 4, updatedAt: 9 });
        expect(await r.getMascotState()).toEqual({ phase: 2, careDays: 4, updatedAt: 9 });
      }
    });

    it('escritas concorrentes não se perdem', async () => {
      const { r } = await subject();
      const h = uid('h');
      await r.saveHabit({ id: h, title: 'x', weekdays: [0], active: true });
      await Promise.all(
        Array.from({ length: 20 }, (_, i) => r.saveHabitLog({ habitId: h, date: `2026-11-${String(i + 1).padStart(2, '0')}`, doneAt: i })),
      );
      expect(await r.listHabitLogs()).toHaveLength(20);
    });

    it('clearAll zera tudo, inclusive sessões e mascote', async () => {
      const { r, user } = await subject();
      const h = uid('h');
      await r.saveUser(user);
      await r.saveBlock({ id: uid('b'), weekday: 1, startMinutes: 0, durationMinutes: 5, kind: 'descanso' });
      await r.saveHabit({ id: h, title: 'x', weekdays: [0], active: true });
      await r.saveHabitLog({ habitId: h, date: '2026-11-10', doneAt: 1 });
      await r.saveSession({ ...endedSession(1, 25, 'concluida'), id: uid('s') });
      await r.saveRestDay({ date: '2026-11-10' });
      await r.saveProposal({ id: uid('p'), weekStart: '2026-11-09', state: 'pendente', patternText: 'x', changes: [], origin: 'ia', createdAt: 1 });
      if (!options.mascotIsServerDerived) await r.saveMascotState({ phase: 3, careDays: 9, updatedAt: 1 });
      await r.clearAll();
      expect(await r.getUser()).toBeNull();
      expect(await r.listBlocks()).toEqual([]);
      expect(await r.listHabits()).toEqual([]);
      expect(await r.listHabitLogs()).toEqual([]);
      expect(await r.listSessions()).toEqual([]);
      expect(await r.listRestDays()).toEqual([]);
      expect(await r.listProposals()).toEqual([]);
      expect(await r.getMascotState()).toBeNull();
    });
  });
}
