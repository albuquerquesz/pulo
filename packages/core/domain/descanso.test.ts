import { DESCANSO, STREAK } from '../config/decisions';
import { createMemoryRepository } from '../data/memory-repository';
import { desmarcarDescanso, hojeDoDescanso, marcarDescanso, situacaoDoDescanso, validarDescanso, verDescanso } from './descanso';
import { weekdayOf } from './day';
import { streakWeekStart } from './streak';
import { TZ, sp } from './test-utils';
import type { User } from './types';

/** Quarta, 18/11/2026, meio dia em São Paulo. A semana do app vai de domingo (15) a sábado (21). */
const HOJE = '2026-11-18';
const dias = (...n: number[]) => n.map((d) => ({ date: `2026-11-${d}` }));
const user: User = {
  id: 'u1',
  frogName: 'Pulo',
  timezone: TZ,
  dayStartMinutes: 420,
  dayEndMinutes: 1320,
  theme: 'sistema',
  reduceMotion: false,
  createdAt: 1,
};

describe('descanso', () => {
  it('só hoje: ontem e amanhã são recusados', () => {
    expect(validarDescanso(HOJE, HOJE, [])).toEqual({ ok: true, value: HOJE });
    for (const date of ['2026-11-17', '2026-11-19']) {
      expect(validarDescanso(date, HOJE, [])).toMatchObject({ ok: false, error: { code: 'descanso_so_hoje' } });
    }
  });

  it('hoje respeita o fuso e o começo do dia da pessoa', () => {
    // 15h30 UTC do dia 18 já é 00h30 do dia 19 em Tóquio: com o dia começando às 4h, ainda é 18.
    const now = Date.UTC(2026, 10, 18, 15, 30);
    const toquio = { dated: [], timeZone: 'Asia/Tokyo', dayStartMinutes: 240, now };
    expect(hojeDoDescanso({ ...toquio, date: HOJE })).toBe(HOJE);
    expect(hojeDoDescanso({ ...toquio, date: '2026-11-19' })).toBe(HOJE);
    expect(hojeDoDescanso({ ...toquio, date: '2026-11-19', dayStartMinutes: 0 })).toBe('2026-11-19');
  });

  it('entre a virada do app e o começo do dia, o dia novo e o da pessoa valem; com registro no novo, só ele', () => {
    const base = { timeZone: TZ, dayStartMinutes: 420, now: sp(2026, 11, 18, 5) };
    expect(hojeDoDescanso({ ...base, dated: [], date: HOJE })).toBe(HOJE);
    expect(hojeDoDescanso({ ...base, dated: [], date: '2026-11-17' })).toBe('2026-11-17');
    expect(hojeDoDescanso({ ...base, dated: [HOJE], date: '2026-11-17' })).toBe(HOJE);
  });

  it('limite por semana, começando em STREAK.weekStartsOn; semana anterior não conta', () => {
    expect(weekdayOf(streakWeekStart(HOJE))).toBe(STREAK.weekStartsOn);
    expect(situacaoDoDescanso(HOJE, dias(14))).toEqual({ restantesNaSemana: DESCANSO.maxPorSemana, maxPorSemana: DESCANSO.maxPorSemana });
    expect(situacaoDoDescanso(HOJE, dias(15)).restantesNaSemana).toBe(1);
    expect(validarDescanso(HOJE, HOJE, dias(15, 16))).toMatchObject({ ok: false, error: { code: 'limite_de_descanso' } });
    // Marcar de novo o de hoje é aceito.
    expect(validarDescanso(HOJE, HOJE, dias(15, 18)).ok).toBe(true);
  });

  it('no repositório local: marca, conta e desmarca só hoje', async () => {
    const repo = createMemoryRepository({ user });
    const clock = { now: () => sp(2026, 11, 18) };
    expect(await marcarDescanso(repo, clock, '2026-11-17')).toMatchObject({ ok: false });
    expect(await marcarDescanso(repo, clock, HOJE)).toMatchObject({ ok: true });
    expect((await verDescanso(repo, clock)).restantesNaSemana).toBe(1);
    expect(await desmarcarDescanso(repo, clock, '2026-11-17')).toMatchObject({ ok: false });
    expect(await desmarcarDescanso(repo, clock, HOJE)).toMatchObject({ ok: true });
    expect(await repo.listRestDays()).toEqual([]);
  });
});
