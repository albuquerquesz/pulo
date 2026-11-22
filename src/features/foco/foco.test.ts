import { createMemoryRepository } from '@/data';
import { fixedClock } from '@/domain/clock';
import { sp } from '@/domain/test-utils';

import { concluirOnboarding } from '../app/core';
import { registrarEnergia } from '../hoje/logic';
import { abrirFoco, concluir, iniciar, parar, pausar, retomar, TEXTO_CONCLUIU_FORA } from './logic';

const clock = () => fixedClock(sp(2026, 11, 23, 10, 0));
const MIN = 60_000;

async function novo() {
  const repo = createMemoryRepository();
  const c = clock();
  const user = await concluirOnboarding(repo, c, { frogName: 'Juca', startHour: 7, endHour: 22 });
  return { repo, c, user };
}

describe('Foco', () => {
  test('sem sessão a aba está ociosa', async () => {
    const { repo, c, user } = await novo();
    expect((await abrirFoco(repo, c, user)).fase).toBe('ocioso');
  });

  test('com sessão em andamento a aba abre direto nela, com o tempo do relógio', async () => {
    const { repo, c, user } = await novo();
    await iniciar(repo, c, user);
    c.advance(5 * MIN);
    const e = await abrirFoco(repo, c, user);
    expect(e.fase).toBe('ativa');
    expect(e.sessao?.plannedMinutes).toBe(25);
  });

  test('pausar e retomar', async () => {
    const { repo, c, user } = await novo();
    await iniciar(repo, c, user);
    expect((await pausar(repo, c, user)).sessao?.pausedSince).toBeDefined();
    c.advance(10 * MIN);
    const r = await retomar(repo, c, user);
    expect(r.sessao?.pausedSince).toBeUndefined();
    expect(r.sessao?.pausedMs).toBe(10 * MIN);
  });

  test('reabrir depois do fim mostra que concluiu fora, com sapo feliz e pergunta de energia', async () => {
    const { repo, c, user } = await novo();
    await iniciar(repo, c, user);
    c.advance(40 * MIN);
    const e = await abrirFoco(repo, c, user);
    expect(e.fase).toBe('concluida');
    expect(e.concluiuFora).toBe(true);
    expect(e.feliz).toBe(true);
    expect(e.perguntarEnergia).toBe(true);
    expect(TEXTO_CONCLUIU_FORA).toBe('Você concluiu enquanto estava fora');
    // o fim é o calculado, não a hora da reabertura
    expect(e.sessao?.endedAt).toBe(sp(2026, 11, 23, 10, 25));
  });

  test('concluir com a tela aberta guarda a sessão e não repete a pergunta se já respondeu energia', async () => {
    const { repo, c, user } = await novo();
    await registrarEnergia(repo, c, user, 4);
    await iniciar(repo, c, user);
    c.advance(25 * MIN);
    const e = await concluir(repo, c, user);
    expect(e.fase).toBe('concluida');
    expect(e.perguntarEnergia).toBe(false);
    expect((await repo.listSessions())[0].state).toBe('concluida');
  });

  test('parar por agora interrompe sem culpa', async () => {
    const { repo, c, user } = await novo();
    await iniciar(repo, c, user);
    c.advance(3 * MIN);
    const e = await parar(repo, c, user);
    expect(e.fase).toBe('interrompida');
    expect(e.feliz).toBe(false);
    expect((await abrirFoco(repo, c, user)).fase).toBe('ocioso');
  });
});
