import { RemoteError } from '@pulo/client';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { createMemoryRepository } from '@/data';

import type { Autenticacao } from '../sessao/auth';
import { AppProvider, useApp } from './AppProvider';
import { concluirOnboarding } from './core';

const PESSOA = { id: '1', nome: 'Ana Souza', email: 'ana@exemplo.test' };

function autenticacao(mudanca: Partial<Autenticacao> = {}): Autenticacao {
  return {
    sessaoAtual: async () => PESSOA,
    entrarComGoogle: async () => undefined,
    sair: async () => undefined,
    atualizarConta: async () => undefined,
    rede: () => ({ baseUrl: 'http://api.exemplo.test' }),
    ...mudanca,
  };
}

function Sonda() {
  const app = useApp();
  return (
    <>
      <output>{`${app.fase} ${app.entrando ? 'entrando' : 'parado'}`}</output>
      <p>{app.erroDeLogin}</p>
      <p>{app.aviso?.mensagem}</p>
      <button type="button" onClick={() => void app.sair()}>sair</button>
      <button type="button" onClick={() => void app.entrar()}>entrar</button>
      <button type="button" onClick={() => void app.editarConta({ nome: 'Bia', foto: null }).catch(() => undefined)}>editar</button>
    </>
  );
}

async function abrir(auth: Autenticacao) {
  render(
    <AppProvider repoInicial={createMemoryRepository()} autenticacao={auth}>
      <Sonda />
    </AppProvider>,
  );
  await screen.findByText('pronto parado');
}

const clicar = (name: string) => act(async () => void fireEvent.click(screen.getByRole('button', { name })));
const estado = () => screen.getByRole('status').textContent;

describe('sessão no AppProvider', () => {
  test('sair sem o servidor confirmar mantém a sessão e avisa', async () => {
    await abrir(autenticacao({ sair: () => Promise.reject(new Error('sem rede')) }));
    await clicar('sair');
    expect(estado()).toBe('pronto parado');
    expect(screen.getByText('Não foi possível sair agora. Confira sua conexão e tente de novo.')).toBeTruthy();
  });

  test('depois de ir para o Google o botão continua ocupado, sem reabrir o app', async () => {
    const sessaoAtual = vi.fn(async () => PESSOA);
    await abrir(autenticacao({ sessaoAtual }));
    await clicar('entrar');
    expect(estado()).toBe('pronto entrando');
    expect(sessaoAtual).toHaveBeenCalledTimes(1);
  });

  test('sessão vencida ao editar a conta volta ao login com explicação', async () => {
    const vencida = new RemoteError({ kind: 'sessao', mensagem: 'x' });
    await abrir(autenticacao({ atualizarConta: () => Promise.reject(vencida) }));
    await clicar('editar');
    expect(estado()).toBe('login parado');
    expect(screen.getByText('Sua sessão acabou. Entre de novo para continuar.')).toBeTruthy();
  });
});

describe('concluirOnboarding', () => {
  test('o perfil só é gravado depois do plano: falhando o plano, o onboarding não conta como feito', async () => {
    const base = createMemoryRepository();
    const repo = { ...base, saveHabit: () => Promise.reject(new Error('sem rede')) };
    await expect(concluirOnboarding(repo, { now: () => Date.UTC(2026, 0, 5, 12) }, { frogName: 'Pulo', startHour: 7, endHour: 22 })).rejects.toThrow('sem rede');
    expect(await base.getUser()).toBeNull();
  });
});
