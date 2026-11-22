import { createMemoryRepository } from '../../data/memory-repository';
import { fixedClock, MINUTE_MS } from '../clock';
import { sessionCountsAsCare } from '../care-days';
import { sp, TZ } from '../test-utils';
import {
  carregarSessaoAtiva,
  concluirFoco,
  iniciarFoco,
  interromperFoco,
  pausarFoco,
  retomarFoco,
} from './service';
import {
  interruptSession,
  pauseSession,
  reconcileSession,
  remainingMs,
  resumeSession,
  startSession,
  startShortBreak,
  timerSnapshot,
} from './timer';

const T0 = sp(2026, 11, 10, 9, 0);
const fresh = () => startSession('s1', T0, 25);

describe('timer por horário', () => {
  it('25 min, passados 10: restam 15', () => {
    expect(remainingMs(fresh(), T0 + 10 * MINUTE_MS)).toBe(15 * MINUTE_MS);
    expect(timerSnapshot(fresh(), T0 + 10 * MINUTE_MS).state).toBe('rodando');
  });
  it('pausar 5 min mantém o restante; retomar soma o pausado', () => {
    let s = pauseSession(fresh(), T0 + 10 * MINUTE_MS);
    expect(timerSnapshot(s, T0 + 15 * MINUTE_MS)).toMatchObject({ state: 'pausado', remainingMs: 15 * MINUTE_MS });
    s = resumeSession(s, T0 + 15 * MINUTE_MS);
    expect(s.pausedMs).toBe(5 * MINUTE_MS);
    expect(s.pausedSince).toBeUndefined();
    expect(remainingMs(s, T0 + 15 * MINUTE_MS)).toBe(15 * MINUTE_MS);
    expect(remainingMs(s, T0 + 20 * MINUTE_MS)).toBe(10 * MINUTE_MS);
  });
  it('reabrir no meio devolve o tempo certo', () => {
    const s = fresh();
    expect(reconcileSession(s, T0 + 7 * MINUTE_MS)).toBe(s);
    expect(remainingMs(s, T0 + 7 * MINUTE_MS)).toBe(18 * MINUTE_MS);
  });
  it('pausado nunca acaba sozinho', () => {
    const s = pauseSession(fresh(), T0 + 10 * MINUTE_MS);
    expect(reconcileSession(s, T0 + 600 * MINUTE_MS)).toBe(s);
  });
  it('reabrir depois do fim conclui com fim calculado, não com a hora da reabertura', () => {
    let s = pauseSession(fresh(), T0 + 5 * MINUTE_MS);
    s = resumeSession(s, T0 + 8 * MINUTE_MS); // 3 min pausado
    const done = reconcileSession(s, T0 + 300 * MINUTE_MS);
    expect(done.state).toBe('concluida');
    expect(done.endedAt).toBe(T0 + 25 * MINUTE_MS + 3 * MINUTE_MS);
    expect(done.pausedMs).toBe(3 * MINUTE_MS);
  });
  it('interromper: 12 de 25 não conta, 13 conta', () => {
    const a = interruptSession(fresh(), T0 + 12 * MINUTE_MS);
    const b = interruptSession(fresh(), T0 + 13 * MINUTE_MS);
    expect(a.state).toBe('interrompida');
    expect(sessionCountsAsCare(a)).toBe(false);
    expect(sessionCountsAsCare(b)).toBe(true);
  });
  it('interromper durante pausa não conta a pausa como esforço', () => {
    let s = pauseSession(fresh(), T0 + 12 * MINUTE_MS);
    s = interruptSession(s, T0 + 60 * MINUTE_MS);
    expect(s.pausedMs).toBe(48 * MINUTE_MS);
    expect(sessionCountsAsCare(s)).toBe(false);
  });
  it('estados: ocioso, pausa curta, concluído, interrompido', () => {
    expect(timerSnapshot(null, T0).state).toBe('ocioso');
    const brk = startShortBreak(T0, 5);
    expect(timerSnapshot(null, T0 + MINUTE_MS, brk)).toMatchObject({ state: 'em_pausa_curta', remainingMs: 4 * MINUTE_MS });
    expect(timerSnapshot(null, T0 + 6 * MINUTE_MS, brk).state).toBe('ocioso');
    expect(timerSnapshot(reconcileSession(fresh(), T0 + 30 * MINUTE_MS), T0 + 30 * MINUTE_MS).state).toBe('concluido');
    expect(timerSnapshot(interruptSession(fresh(), T0 + 3 * MINUTE_MS), T0 + 9 * MINUTE_MS).state).toBe('interrompido');
  });
});

describe('serviço de foco com repositório', () => {
  it('concluir emite bloco_concluido, atualiza o dia de cuidado e a fase', async () => {
    const repo = createMemoryRepository();
    const clock = fixedClock(T0);
    const start = await iniciarFoco(repo, clock, TZ);
    expect(start.ok).toBe(true);
    clock.advance(25 * MINUTE_MS);
    const r = await concluirFoco(repo, clock, TZ);
    if (!r.ok) throw new Error('x');
    expect(r.value.ended).toBe(true);
    expect(r.value.events).toEqual(['bloco_concluido']);
    expect(r.value.mascot?.state.careDays).toBe(1);
    expect(r.value.session.endedAt).toBe(T0 + 25 * MINUTE_MS);
  });
  it('só uma sessão por vez', async () => {
    const repo = createMemoryRepository();
    const clock = fixedClock(T0);
    await iniciarFoco(repo, clock, TZ);
    clock.advance(5 * MINUTE_MS);
    const second = await iniciarFoco(repo, clock, TZ);
    expect(!second.ok && second.error.code).toBe('sessao_em_andamento');
    expect(await repo.listSessions()).toHaveLength(1);
  });
  it('nova sessão é permitida se a anterior já acabou pelo relógio', async () => {
    const repo = createMemoryRepository();
    const clock = fixedClock(T0);
    await iniciarFoco(repo, clock, TZ);
    clock.advance(60 * MINUTE_MS);
    const second = await iniciarFoco(repo, clock, TZ);
    expect(second.ok).toBe(true);
    const sessions = await repo.listSessions();
    expect(sessions.filter((s) => s.state === 'concluida')).toHaveLength(1);
  });
  it('reabrir depois do fim marca concluiu enquanto estava fora', async () => {
    const repo = createMemoryRepository();
    const clock = fixedClock(T0);
    await iniciarFoco(repo, clock, TZ);
    clock.advance(10 * 60 * MINUTE_MS);
    const r = await carregarSessaoAtiva(repo, clock, TZ);
    expect(r?.concludedWhileAway).toBe(true);
    expect(r?.session.endedAt).toBe(T0 + 25 * MINUTE_MS);
    expect(await carregarSessaoAtiva(repo, clock, TZ)).toBeNull();
  });
  it('reabrir no meio reaparece em andamento', async () => {
    const repo = createMemoryRepository();
    const clock = fixedClock(T0);
    await iniciarFoco(repo, clock, TZ);
    clock.advance(10 * MINUTE_MS);
    const r = await carregarSessaoAtiva(repo, clock, TZ);
    expect(r?.ended).toBe(false);
    expect(remainingMs(r!.session, clock.now())).toBe(15 * MINUTE_MS);
  });
  it('pausar, retomar e interromper persistem e a interrompida conta se >= metade', async () => {
    const repo = createMemoryRepository();
    const clock = fixedClock(T0);
    await iniciarFoco(repo, clock, TZ);
    clock.advance(10 * MINUTE_MS);
    await pausarFoco(repo, clock, TZ);
    clock.advance(20 * MINUTE_MS);
    await retomarFoco(repo, clock, TZ);
    clock.advance(3 * MINUTE_MS);
    const r = await interromperFoco(repo, clock, TZ);
    if (!r.ok) throw new Error('x');
    expect(r.value.session.state).toBe('interrompida');
    expect(r.value.countsAsCare).toBe(true); // 13 minutos efetivos
    expect(r.value.events).toEqual([]);
  });
  it('interrompida abaixo da metade não conta e não gera dia de cuidado', async () => {
    const repo = createMemoryRepository();
    const clock = fixedClock(T0);
    await iniciarFoco(repo, clock, TZ);
    clock.advance(12 * MINUTE_MS);
    const r = await interromperFoco(repo, clock, TZ);
    if (!r.ok) throw new Error('x');
    expect(r.value.countsAsCare).toBe(false);
    expect(r.value.mascot?.state.careDays).toBe(0);
  });
  it('duração fora da faixa é recusada; sem sessão ativa também', async () => {
    const repo = createMemoryRepository();
    const clock = fixedClock(T0);
    const bad = await iniciarFoco(repo, clock, TZ, { plannedMinutes: 10 });
    expect(!bad.ok && bad.error.code).toBe('duracao_invalida');
    const none = await pausarFoco(repo, clock, TZ);
    expect(!none.ok && none.error.code).toBe('sem_sessao');
  });
  it('3º dia de cuidado gera o evento marco', async () => {
    const repo = createMemoryRepository();
    const clock = fixedClock(T0);
    let last: string[] = [];
    for (let d = 0; d < 3; d += 1) {
      clock.set(T0 + d * 24 * 60 * MINUTE_MS);
      await iniciarFoco(repo, clock, TZ);
      clock.advance(25 * MINUTE_MS);
      const r = await concluirFoco(repo, clock, TZ);
      if (!r.ok) throw new Error('x');
      last = r.value.events;
    }
    expect(last).toEqual(['bloco_concluido', 'marco']);
  });
});
