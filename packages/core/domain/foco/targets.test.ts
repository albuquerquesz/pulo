import type { FocusSession, RoutineBlock } from '../types';
import { createMemoryRepository } from '../../data/memory-repository';
import { sp } from '../test-utils';
import { countPomodoros } from '../tasks';
import { buildWeekSummary } from '../week-summary';
import { focoDoDia, proximoFoco } from './next';
import { iniciarFoco } from './service';
import { focusByTarget } from './targets';

const TZ = 'America/Sao_Paulo';
const MIN = 60_000;
let n = 0;
const ended = (startedAt: number, minutes: number, extra: Partial<FocusSession> = {}): FocusSession => ({
  id: `s${++n}`,
  startedAt,
  endedAt: startedAt + minutes * MIN,
  plannedMinutes: minutes,
  state: 'concluida',
  pausedMs: 0,
  ...extra,
});
const block = (id: string, startMinutes: number, extra: Partial<RoutineBlock> = {}): RoutineBlock => ({
  id,
  weekday: 0,
  startMinutes,
  durationMinutes: 30,
  kind: 'foco',
  ...extra,
});

describe('foco por alvo', () => {
  it('soma por alvo, junta as sem vínculo e ordena do maior para o menor', () => {
    const sessions = [
      ended(sp(2026, 11, 16, 9), 25, { habitId: 'h' }),
      ended(sp(2026, 11, 16, 10), 25, { habitId: 'h' }),
      ended(sp(2026, 11, 16, 11), 30, { goalId: 'g' }),
      ended(sp(2026, 11, 16, 12), 15),
      ended(sp(2026, 11, 16, 13), 20, { state: 'interrompida' }),
      { id: 'aberta', startedAt: sp(2026, 11, 16, 14), plannedMinutes: 25, state: 'em_andamento', pausedMs: 0, taskId: 't' } as const,
    ];
    expect(focusByTarget(sessions)).toEqual([
      { alvo: { tipo: 'habito', id: 'h' }, minutos: 50 },
      { alvo: null, minutos: 35 },
      { alvo: { tipo: 'meta', id: 'g' }, minutos: 30 },
    ]);
  });

  it('o resumo traz terminadas, largadas, alvo e melhor período', () => {
    const summary = buildWeekSummary({
      weekStart: '2026-11-16',
      timeZone: TZ,
      sessions: [ended(sp(2026, 11, 16, 9), 15), ended(sp(2026, 11, 17, 15), 40, { state: 'interrompida', taskId: 't' })],
      restDays: [],
    });
    expect(summary).toMatchObject({
      sessoesTerminadas: 1,
      sessoesLargadas: 1,
      melhorPeriodo: 'tarde',
      focoPorAlvo: [
        { alvo: { tipo: 'tarefa', id: 't' }, minutos: 40 },
        { alvo: null, minutos: 15 },
      ],
    });
    expect(buildWeekSummary({ weekStart: '2026-11-16', timeZone: TZ, sessions: [], restDays: [] }).melhorPeriodo).toBeNull();
  });

  it('pomodoros: só as concluídas com tarefa', () => {
    expect(
      countPomodoros([
        ended(0, 25, { taskId: 't' }),
        ended(0, 25, { taskId: 't' }),
        ended(0, 25, { taskId: 't', state: 'interrompida' }),
        ended(0, 25),
      ]),
    ).toEqual({ t: 2 });
  });
});

describe('próximo foco', () => {
  // 2026-11-16 é segunda-feira.
  const blocks = [block('manha', 9 * 60, { title: 'Estudar' }), block('tarde', 15 * 60), block('pausa', 11 * 60, { kind: 'descanso' })];
  const at = (hour: number, minute = 0) => sp(2026, 11, 16, hour, minute);
  const next = (now: number, sessions: FocusSession[] = [], list = blocks) => proximoFoco({ blocks: list, sessions, now, timeZone: TZ });

  it('rotina vazia não tem próximo foco', () => {
    expect(next(at(8), [], [])).toBeNull();
  });

  it('antes, durante e depois de cada bloco', () => {
    expect(next(at(8))).toMatchObject({ bloco: { id: 'manha' }, estado: 'depois', intencao: 'Estudar' });
    expect(next(at(9, 10))).toMatchObject({ bloco: { id: 'manha' }, estado: 'agora' });
    expect(next(at(10))).toMatchObject({ bloco: { id: 'tarde' }, estado: 'depois' });
    expect(next(at(15, 30))).toBeNull();
  });

  it('foco aberto no bloco aparece em andamento, com a intenção dele', () => {
    const open: FocusSession = {
      id: 'aberta',
      blockId: 'manha',
      startedAt: at(9),
      plannedMinutes: 30,
      state: 'em_andamento',
      pausedMs: 0,
      intention: 'Capítulo 2',
    };
    expect(next(at(9, 10), [open])).toMatchObject({ estado: 'em_andamento', intencao: 'Capítulo 2', sessaoId: 'aberta' });
    // Acabou o tempo e ninguém fechou: vale como concluído.
    expect(next(at(9, 31), [open])).toMatchObject({ bloco: { id: 'tarde' } });
  });

  it('bloco concluído hoje sai; interrompido continua', () => {
    expect(next(at(9, 10), [ended(at(9), 15, { blockId: 'manha' })])).toMatchObject({ bloco: { id: 'tarde' } });
    expect(next(at(9, 20), [ended(at(9), 15, { blockId: 'manha', state: 'interrompida' })])).toMatchObject({ bloco: { id: 'manha' } });
  });

  it('de madrugada, antes da virada, o dia ainda é o anterior', () => {
    expect(next(sp(2026, 11, 17, 1))).toBeNull();
  });

  it('barra do dia: soma o foco aberto e respeita a meta', () => {
    const open: FocusSession = { id: 'a', startedAt: at(10), plannedMinutes: 30, state: 'em_andamento', pausedMs: 0 };
    const sessions = [ended(at(9), 25), open];
    expect(focoDoDia(sessions, 70, '2026-11-16', at(10, 10), TZ)).toEqual({ minutos: 35, meta: 70, fracao: 0.5 });
    expect(focoDoDia(sessions, null, '2026-11-16', at(10, 10), TZ)).toEqual({ minutos: 35, meta: null, fracao: null });
  });
});

describe('iniciarFoco com intenção e vínculo', () => {
  const clock = { now: () => sp(2026, 11, 16, 9) };

  it('grava intenção aparada e o alvo; recusa dois alvos, alvo que não existe e texto longo', async () => {
    const repo = createMemoryRepository();
    await repo.saveHabit({ id: 'h', title: 'Ler', weekdays: [0], state: 'ativo' });
    expect(await iniciarFoco(repo, clock, TZ, { habitId: 'h', goalId: 'g' })).toMatchObject({ error: { code: 'vinculo_duplo' } });
    expect(await iniciarFoco(repo, clock, TZ, { taskId: 'x' })).toMatchObject({ error: { code: 'alvo_inexistente' } });
    expect(await iniciarFoco(repo, clock, TZ, { intention: 'a'.repeat(141) })).toMatchObject({ error: { code: 'intencao_invalida' } });
    const r = await iniciarFoco(repo, clock, TZ, { habitId: 'h', intention: '  Capítulo 2  ' });
    expect(r).toMatchObject({ ok: true, value: { session: { habitId: 'h', intention: 'Capítulo 2' } } });
  });
});
