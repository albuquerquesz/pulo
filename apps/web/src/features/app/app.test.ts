import { createMemoryRepository } from '@/data';
import { fixedClock } from '@pulo/core/domain/clock';
import { sp } from '@pulo/core/domain/test-utils';

import {
  agoraDaLagoa,
  apagarTodosOsDados,
  concluirOnboarding,
  criarClienteDeIa,
  normalizarHorarios,
  rotaInicial,
  salvarPerfil,
} from './core';
import { criarContaDeExemplo } from '../../testing/conta-de-exemplo';

const clock = () => fixedClock(sp(2026, 11, 23, 10, 0));

describe('primeira rota', () => {
  test('sem User vai para o onboarding; com User vai para Hoje', async () => {
    const repo = createMemoryRepository();
    expect(await rotaInicial(repo)).toBe('/onboarding');
    await concluirOnboarding(repo, clock(), { frogName: 'Juca', startHour: 7, endHour: 22 });
    expect(await rotaInicial(repo)).toBe('/');
  });
});

describe('onboarding', () => {
  test('cria o User, o plano de exemplo e o estado do sapo', async () => {
    const repo = createMemoryRepository();
    const user = await concluirOnboarding(repo, clock(), { frogName: '  Juca ', startHour: 7, endHour: 22 });
    expect(user.frogName).toBe('Juca');
    expect(user.dayStartMinutes).toBe(7 * 60);
    expect(user.dayEndMinutes).toBe(22 * 60);
    expect(await repo.getUser()).toEqual(user);
    expect((await repo.listBlocks()).length).toBeGreaterThan(0);
    expect((await repo.listHabits()).length).toBeGreaterThan(0);
    expect((await repo.getMascotState())?.phase).toBe(1);
  });

  test('nome vazio usa o nome padrão e horários invertidos são corrigidos', async () => {
    const repo = createMemoryRepository();
    const user = await concluirOnboarding(repo, clock(), { frogName: '   ', startHour: 20, endHour: 8 });
    expect(user.frogName).toBe('Pulo');
    expect(user.dayEndMinutes).toBeGreaterThan(user.dayStartMinutes);
    expect(normalizarHorarios(7, 22)).toEqual({ startHour: 7, endHour: 22 });
  });
});

describe('apagar todos os dados', () => {
  test('zera tudo e volta ao onboarding', async () => {
    const repo = createMemoryRepository();
    await concluirOnboarding(repo, clock(), { frogName: 'Juca', startHour: 7, endHour: 22 });
    await repo.saveRestDay({ date: '2026-11-23' });
    await apagarTodosOsDados(repo);
    expect(await repo.getUser()).toBeNull();
    expect(await repo.listBlocks()).toEqual([]);
    expect(await repo.listHabits()).toEqual([]);
    expect(await repo.listRestDays()).toEqual([]);
    expect(await repo.getMascotState()).toBeNull();
    expect(await rotaInicial(repo)).toBe('/onboarding');
  });
});

describe('perfil', () => {
  test('salva tema, reduzir movimento e horários mantendo o fim depois do início', async () => {
    const repo = createMemoryRepository();
    const user = await concluirOnboarding(repo, clock(), { frogName: 'Juca', startHour: 7, endHour: 22 });
    const a = await salvarPerfil(repo, user, { theme: 'escuro', reduceMotion: true });
    expect((await repo.getUser())?.theme).toBe('escuro');
    expect(a.reduceMotion).toBe(true);
    const b = await salvarPerfil(repo, a, { dayStartMinutes: 23 * 60 });
    expect(b.dayEndMinutes).toBeGreaterThan(b.dayStartMinutes);
  });
});

describe('lagoa', () => {
  test('a lagoa recebe o momento calculado pela tela', async () => {
    const conta = await criarContaDeExemplo();
    const user = (await conta.repo.getUser())!;
    const m = (await conta.repo.getMascotState())!;
    const agora = agoraDaLagoa(user, conta.clock.now(), m.careDays, false);
    expect(agora.diasDeCuidadoTotal).toBe(m.careDays);
    expect(typeof agora.dentroDoDia).toBe('boolean');
  });
});

describe('cliente de IA', () => {
  test('sem endpoint não há cliente (a regra assume e o rótulo é Sugestão)', () => {
    expect(criarClienteDeIa(undefined)).toBeNull();
    expect(criarClienteDeIa('')).toBeNull();
    expect(criarClienteDeIa('https://exemplo.test/ia')).not.toBeNull();
  });
});
