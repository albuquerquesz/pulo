import { PHASE_MIN_CARE_DAYS, STABLE_WEEK_MIN_CARE_DAYS } from '../config/decisions';
import { computeCandidates } from '../domain/ia/candidates';
import { countCareDays, phaseForCareDays } from './careDays';
import { createDemoClock } from './clock';
import { generateDemoData } from './generate';
import { seedRepository } from './seed';
import { createFakeRepository } from './fakeRepository';
import { summarizeDemoWeek } from './summary';
import { dateKeyOf } from './time';

describe('demo', () => {
  it('é determinístico e muda com a seed', () => {
    expect(generateDemoData(1)).toEqual(generateDemoData(1));
    expect(generateDemoData(1)).not.toEqual(generateDemoData(2));
  });

  it('cobre 4 semanas e só tem dados sintéticos', () => {
    const d = generateDemoData();
    const dates = d.sessions.map((s) => dateKeyOf(s.startedAt)).sort();
    expect(dates[0]).toBe('2026-10-26');
    expect(dates[dates.length - 1] <= '2026-11-22').toBe(true);
    expect(JSON.stringify(d)).not.toMatch(/@|http/);
  });

  it('leva o sapo à fase 4 e a última semana é estável', () => {
    const d = generateDemoData();
    const care = countCareDays(d.sessions, d.restDays);
    expect(care).toBeGreaterThanOrEqual(PHASE_MIN_CARE_DAYS[4]);
    expect(phaseForCareDays(care)).toBe(4);
    const w = summarizeDemoWeek('2026-11-16', d.sessions, d.checkIns, d.restDays, STABLE_WEEK_MIN_CARE_DAYS);
    expect(w.stable).toBe(true);
  });

  it('não regride a fase depois de avançar o relógio sem registros', () => {
    const clock = createDemoClock();
    const d = generateDemoData();
    clock.advanceDays(15);
    expect(phaseForCareDays(countCareDays(d.sessions, d.restDays))).toBe(4);
  });

  it('dá um padrão claro para a IA: candidata mover da tarde para a manhã', () => {
    const d = generateDemoData();
    const w = summarizeDemoWeek('2026-11-16', d.sessions, d.checkIns, d.restDays, STABLE_WEEK_MIN_CARE_DAYS);
    const cands = computeCandidates(w, d.blocks);
    expect(cands.length).toBeGreaterThan(0);
    expect(cands[0].kind).toBe('mover_foco');
    expect(cands[0].fromPeriod).toBe('tarde');
    expect(cands[0].toPeriod).toBe('manha');
    expect(cands.some((c) => c.kind === 'encurtar_foco')).toBe(true);
  });

  it('relógio: avança dias e semanas e reinicia', () => {
    const c = createDemoClock();
    const t0 = c.now();
    expect(c.today()).toBe('2026-11-22');
    c.advanceDays(1);
    expect(c.today()).toBe('2026-11-23');
    c.advanceWeeks(1);
    expect(c.now() - t0).toBe(8 * 86_400_000);
    c.reset();
    expect(c.now()).toBe(t0);
  });

  it('seedRepository grava tudo e o estado do sapo em fase 4', async () => {
    const repo = createFakeRepository();
    const clock = createDemoClock();
    await seedRepository(repo, clock);
    const d = generateDemoData(undefined, clock.now());
    expect((await repo.listSessions()).length).toBe(d.sessions.length);
    expect((await repo.listBlocks()).length).toBe(d.blocks.length);
    expect((await repo.getMascotState())?.phase).toBe(4);
    expect((await repo.getUser())?.id).toBe('demo-user');
    await seedRepository(repo, clock);
    expect((await repo.listSessions()).length).toBe(d.sessions.length);
  });
});
