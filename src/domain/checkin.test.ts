import { createMemoryRepository } from '@/data/memory-repository';
import {
  energyByPeriod,
  latestEnergyToday,
  registrarCheckIn,
  shouldAskAfterFocus,
  shouldInvite,
  inviteKey,
} from './checkin';
import { checkIn, sp, TZ } from './test-utils';

describe('check in de energia', () => {
  it('responder duas vezes no mesmo período mantém só a última', async () => {
    const repo = createMemoryRepository();
    await registrarCheckIn(repo, 2, sp(2026, 11, 10, 8), TZ);
    await registrarCheckIn(repo, 4, sp(2026, 11, 10, 10), TZ);
    const all = await repo.listCheckIns();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ energy: 4, period: 'manha', date: '2026-11-10' });
  });
  it('períodos diferentes ficam separados', async () => {
    const repo = createMemoryRepository();
    await registrarCheckIn(repo, 2, sp(2026, 11, 10, 8), TZ);
    await registrarCheckIn(repo, 5, sp(2026, 11, 10, 14), TZ);
    expect(await repo.listCheckIns()).toHaveLength(2);
  });
  it('recusa energia fora de 1 a 5', async () => {
    const repo = createMemoryRepository();
    for (const e of [0, 6, 2.5, NaN]) {
      const r = await registrarCheckIn(repo, e, sp(2026, 11, 10, 8), TZ);
      expect(r.ok).toBe(false);
    }
    expect(await repo.listCheckIns()).toHaveLength(0);
  });
  it('a média considera só o período', () => {
    const e = energyByPeriod([checkIn('d', 'manha', 2), checkIn('d', 'manha', 4), checkIn('d', 'tarde', 5)]);
    expect(e.manha).toEqual({ average: 3, checkIns: 2 });
    expect(e.tarde).toEqual({ average: 5, checkIns: 1 });
    expect(e.noite).toEqual({ average: null, checkIns: 0 });
  });
  it('o registro salvo só tem campos fixos', async () => {
    const repo = createMemoryRepository();
    await registrarCheckIn(repo, 3, sp(2026, 11, 10, 8), TZ);
    expect(Object.keys((await repo.listCheckIns())[0]).sort()).toEqual(['createdAt', 'date', 'energy', 'id', 'period']);
  });
  it('convite: some se respondido ou ignorado; pós foco só sem resposta', async () => {
    const now = sp(2026, 11, 10, 9);
    expect(shouldInvite([], now, TZ)).toBe(true);
    expect(shouldInvite([], now, TZ, new Set([inviteKey('2026-11-10', 'manha')]))).toBe(false);
    expect(shouldInvite([], sp(2026, 11, 10, 15), TZ, new Set([inviteKey('2026-11-10', 'manha')]))).toBe(true);
    const answered = [checkIn('2026-11-10', 'manha', 3)];
    expect(shouldInvite(answered, now, TZ)).toBe(false);
    expect(shouldAskAfterFocus(answered, now, TZ)).toBe(false);
    expect(shouldAskAfterFocus([], now, TZ)).toBe(true);
  });
  it('energia mais recente do dia', () => {
    const now = sp(2026, 11, 10, 15);
    const list = [checkIn('2026-11-10', 'manha', 2, 1), checkIn('2026-11-10', 'tarde', 5, 2), checkIn('2026-11-09', 'noite', 1, 3)];
    expect(latestEnergyToday(list, now, TZ)).toBe(5);
    expect(latestEnergyToday([], now, TZ)).toBeNull();
  });
});
