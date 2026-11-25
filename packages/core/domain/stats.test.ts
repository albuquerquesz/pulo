import { computeStats } from './stats';
import type { FocusSession } from './types';

const T = 1_795_000_000_000;
const MIN = 60_000;
const session = (id: string, minutes: number, extra: Partial<FocusSession> = {}): FocusSession => ({
  id,
  startedAt: T,
  endedAt: T + minutes * MIN,
  plannedMinutes: 25,
  state: 'concluida',
  pausedMs: 0,
  ...extra,
});

describe('estatísticas do perfil', () => {
  it('soma o foco sem as pausas, até o planejado, ignorando o que está em andamento', () => {
    const sessions = [
      session('a', 25),
      session('b', 40),
      session('c', 12, { state: 'interrompida', pausedMs: 2 * MIN }),
      session('d', 20, { state: 'em_andamento', endedAt: undefined }),
    ];
    expect(computeStats({ habitosFeitos: 4, sessions, desde: T })).toEqual({ habitosFeitos: 4, minutosDeFoco: 60, desde: T });
  });
});
