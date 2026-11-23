import { createMemoryRepository } from '@/data';
import { fixedClock } from '@pulo/core/domain/clock';
import { endedSession, sp } from '@pulo/core/domain/test-utils';
import { criarPlanoInicial } from '@pulo/core/domain/routine';
import type { Repository, User } from '@pulo/core/domain/types';

import { concluirOnboarding } from '../app/core';
import { criarSessaoDemo } from '../app/demo';
import {
  alternarHabito,
  carregarHoje,
  comecarFoco,
  diaDeDescanso,
  fraseDoSapo,
  progressoDaFase,
} from './logic';

// segunda-feira, 10h em Sao Paulo
const clock = () => fixedClock(sp(2026, 11, 23, 10, 0));

async function novo(): Promise<{ repo: Repository; user: User; c: ReturnType<typeof clock> }> {
  const repo = createMemoryRepository();
  const c = clock();
  const user = await concluirOnboarding(repo, c, { frogName: 'Juca', startHour: 7, endHour: 22 });
  return { repo, user, c };
}

describe('Hoje', () => {
  test('com plano de exemplo mostra blocos e hábitos do dia, fase 1', async () => {
    const { repo, user, c } = await novo();
    const d = await carregarHoje(repo, c, user);
    expect(d.temRotina).toBe(true);
    expect(d.blocos.length).toBe(3);
    expect(d.habitos.length).toBe(2);
    expect(d.mascote.phase).toBe(1);
    expect(d.focosInterrompidosHoje).toBe(0);
    expect(d.sessaoAtiva).toBeNull();
  });

  test('sem blocos é o estado vazio, e criar o plano de exemplo resolve', async () => {
    const repo = createMemoryRepository();
    const c = clock();
    const user = await concluirOnboarding(repo, c, { frogName: 'Juca', startHour: 7, endHour: 22 });
    for (const b of await repo.listBlocks()) await repo.deleteBlock(b.id);
    expect((await carregarHoje(repo, c, user)).temRotina).toBe(false);
    await criarPlanoInicial(repo, c.now());
    expect((await carregarHoje(repo, c, user)).temRotina).toBe(true);
  });

  test('o próximo bloco pula os que já passaram', async () => {
    const { repo, user, c } = await novo();
    const d = await carregarHoje(repo, c, user);
    // 10h: o bloco das 9h já acabou, o próximo é o da tarde
    expect(d.proximoBloco?.bloco.startMinutes).toBe(d.blocos[1].bloco.startMinutes);
    c.advance(10 * 60 * 60_000); // 20h: todos os blocos já passaram
    expect((await carregarHoje(repo, c, user)).proximoBloco).toBeNull();
  });

  test('conta os focos interrompidos de hoje', async () => {
    const { repo, user, c } = await novo();
    await repo.saveSession(endedSession(sp(2026, 11, 23, 8, 0), 25, 'interrompida', 5));
    await repo.saveSession(endedSession(sp(2026, 11, 22, 15, 0), 25, 'interrompida', 5));
    expect((await carregarHoje(repo, c, user)).focosInterrompidosHoje).toBe(1);
  });

  test('progresso até a próxima fase', () => {
    expect(progressoDaFase(1, 0)).toEqual({ faltam: 3 });
    expect(progressoDaFase(2, 5)).toEqual({ faltam: 3 });
    expect(progressoDaFase(3, 14)).toEqual({ faltam: 1 });
    expect(progressoDaFase(4, 40)).toEqual({ faltam: null });
  });

  test('marcar e desmarcar hábito', async () => {
    const { repo, user, c } = await novo();
    const id = (await carregarHoje(repo, c, user)).habitos[0].habito.id;
    expect(await alternarHabito(repo, c, user, id, false)).toBe(true);
    expect((await carregarHoje(repo, c, user)).habitos[0].feito).toBe(true);
    expect(await alternarHabito(repo, c, user, id, true)).toBe(false);
    expect((await carregarHoje(repo, c, user)).habitos[0].feito).toBe(false);
  });

  test('dia de descanso conta como cuidado e marca o dia', async () => {
    const { repo, user, c } = await novo();
    const r = await diaDeDescanso(repo, c, user);
    expect(r.state.careDays).toBe(1);
    const d = await carregarHoje(repo, c, user);
    expect(d.descansoHoje).toBe(true);
    expect(fraseDoSapo('parado', d)).toMatch(/descansar/i);
  });

  test('começar foco guarda uma sessão em andamento ligada ao bloco', async () => {
    const { repo, user, c } = await novo();
    const d = await carregarHoje(repo, c, user);
    const r = await comecarFoco(repo, c, user, d.blocos[0].bloco);
    expect(r.ok).toBe(true);
    const depois = await carregarHoje(repo, c, user);
    expect(depois.sessaoAtiva?.blockId).toBe(d.blocos[0].bloco.id);
  });

  test('foco concluído marca o bloco como feito e a sessão vencida não conta como em andamento', async () => {
    const { repo, user, c } = await novo();
    const d = await carregarHoje(repo, c, user);
    await comecarFoco(repo, c, user, d.blocos[0].bloco);
    c.advance(26 * 60_000);
    expect((await carregarHoje(repo, c, user)).sessaoAtiva).toBeNull();
  });

  test('o frase do sapo nunca é vazia', async () => {
    const { repo, user, c } = await novo();
    const d = await carregarHoje(repo, c, user);
    for (const m of ['parado', 'feliz', 'cansado', 'pensando', 'surpreso', 'focado', 'dormindo', 'pouso'] as const) {
      expect(fraseDoSapo(m, d).length).toBeGreaterThan(5);
    }
  });
});

describe('Hoje no modo demo', () => {
  test('o sapo chega à fase 4 e o marco aparece só uma vez ao avançar o relógio', async () => {
    const demo = await criarSessaoDemo();
    const user = (await demo.repo.getUser())!;
    const d = await carregarHoje(demo.repo, demo.clock, user);
    expect(d.mascote.phase).toBe(4);
    demo.clock.advanceDays(1);
    const d2 = await carregarHoje(demo.repo, demo.clock, user);
    expect(d2.mascote.phase).toBe(4);
    expect(d2.marco).toBe(false);
  });
});
