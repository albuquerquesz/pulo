import { fixedClock } from '@pulo/core/domain/clock';
import { sp } from '@pulo/core/domain/test-utils';
import { createMemoryRepository } from '@/data';

import { concluirOnboarding } from '../app/core';
import { comAvisosDeErro } from '../app/repositorio';
import { encerrarFocoVencido, esperaDeNovaTentativa, iniciar } from './logic';

describe('foco vencido', () => {
  test('fecha no fim planejado, só depois que o tempo acaba', async () => {
    const repo = createMemoryRepository();
    const clock = fixedClock(sp(2026, 11, 25, 10, 0));
    const user = await concluirOnboarding(repo, clock, { frogName: 'Juca', startHour: 7, endHour: 22 });
    const inicio = clock.now();
    await iniciar(repo, clock, user, 25);
    expect(await encerrarFocoVencido(repo, clock, user)).toBeNull();
    clock.set(inicio + 3 * 60 * 60_000);
    expect(await encerrarFocoVencido(repo, clock, user)).toMatchObject({ fase: 'concluida', concluiuFora: true });
    expect((await repo.listSessions())[0]).toMatchObject({ state: 'concluida', endedAt: inicio + 25 * 60_000 });
  });

  test('conclusão que segue falhando avisa uma vez só', async () => {
    const memoria = createMemoryRepository();
    vi.spyOn(memoria, 'saveSession').mockRejectedValue(new Error('recusado'));
    const avisar = vi.fn();
    const repo = comAvisosDeErro(memoria, { avisar, sessaoExpirou: vi.fn() });
    const sessao = { id: 's', startedAt: 0, endedAt: 1, plannedMinutes: 25, pausedMs: 0, state: 'concluida' } as const;
    await expect(repo.saveSession(sessao)).rejects.toThrow();
    await expect(repo.saveSession(sessao)).rejects.toThrow();
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  test('a espera dobra até o teto', () => {
    expect([1, 2, 3, 20].map(esperaDeNovaTentativa)).toEqual([5_000, 10_000, 20_000, 300_000]);
  });
});
