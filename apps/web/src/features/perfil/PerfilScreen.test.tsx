import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { Repository } from '@pulo/core/domain/types';

import { AppProvider, useApp } from '../app';
import { temConta, temPreferencias, type FonteDaConta, type FonteDePreferencias } from '../app/conta';
import { criarContaDeExemplo } from '../../testing/conta-de-exemplo';
import type { Autenticacao } from '../sessao/auth';
import { PerfilScreen } from './PerfilScreen';

type RepoDoPerfil = Repository & FonteDaConta & FonteDePreferencias;

function SoPronto({ children }: { children: ReactNode }) {
  const { fase } = useApp();
  return fase === 'pronto' ? children : <p>fase {fase}</p>;
}

async function abrir() {
  const sessao = await criarContaDeExemplo();
  if (!temConta(sessao.repo) || !temPreferencias(sessao.repo)) throw new Error('a conta de exemplo precisa de conta e preferências');
  const repo: RepoDoPerfil = sessao.repo;
  render(
    <AppProvider repoInicial={repo} relogioInicial={sessao.clock}>
      <SoPronto>
        <PerfilScreen />
      </SoPronto>
    </AppProvider>,
  );
  await screen.findByRole('heading', { name: 'Estatísticas' });
  return repo;
}

const clicar = (elemento: HTMLElement) => act(async () => void fireEvent.click(elemento));

describe('PerfilScreen', () => {
  test('blocos na ordem do rascunho', async () => {
    await abrir();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Estatísticas',
      'Conquistas',
      'Métricas',
      'Rotina',
      'Preferências',
      'Conta',
    ]);
    expect(screen.getByText('Desde setembro de 2026')).toBeTruthy();
    expect(screen.getByText('1.240')).toBeTruthy();
    expect(screen.getByText('Continue cuidando do sapo')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Mês de fogo' }).getAttribute('aria-valuenow')).toBe('21');
  });

  test('quem chega por #metricas cai na seção Métricas', async () => {
    window.location.hash = '#metricas';
    await abrir();
    await screen.findByRole('heading', { name: 'Ritmo' });
    // O foco vai para a seção logo depois de ela aparecer; com a máquina ocupada, isso pode levar um instante.
    await waitFor(() => expect(document.activeElement?.id).toBe('metricas'));
    expect(screen.getByRole('heading', { name: 'Descanso e concluído' })).toBeTruthy();
    for (const name of ['Foco por dia', 'Hábitos feitos', 'Descanso e gelo', 'Concluído']) {
      expect(screen.getByRole('figure', { name })).toBeTruthy();
    }
    expect(within(screen.getByRole('figure', { name: 'Foco por dia' })).getByRole('row', { name: /\(hoje\)/ })).toBeTruthy();
    window.location.hash = '';
  });

  test('mudar preferência grava na conta', async () => {
    const repo = await abrir();
    await clicar(screen.getByRole('switch', { name: 'Modo férias' }));
    const preferencias = await repo.getPreferences();
    expect(preferencias).toMatchObject({ vacation: { ligado: true } });
    expect(screen.queryByRole('combobox', { name: 'Duração do foco' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Sons do sapo' })).toBeNull();
  });

  test('tema e começo do dia vão para o usuário', async () => {
    const repo = await abrir();
    await clicar(screen.getByRole('button', { name: 'Escuro' }));
    await clicar(screen.getByRole('combobox', { name: 'Meu dia começa' }));
    await clicar(screen.getByRole('option', { name: '08h00' }));
    expect(await repo.getUser()).toMatchObject({ theme: 'escuro', dayStartMinutes: 480 });
  });

  test('excluir só habilita com EXCLUIR digitado', async () => {
    const repo = await abrir();
    const excluir = vi.spyOn(repo, 'deleteAccount');
    await clicar(screen.getByRole('button', { name: 'Excluir conta' }));
    const dialogo = within(screen.getByRole('dialog', { name: 'Excluir conta' }));
    const confirmar = dialogo.getByRole('button', { name: 'Excluir minha conta' });
    expect(confirmar.hasAttribute('disabled')).toBe(true);
    fireEvent.change(dialogo.getByRole('textbox'), { target: { value: 'excluir' } });
    expect(confirmar.hasAttribute('disabled')).toBe(true);
    fireEvent.change(dialogo.getByRole('textbox'), { target: { value: 'EXCLUIR' } });
    await clicar(confirmar);
    expect(excluir).toHaveBeenCalledTimes(1);
    expect(screen.getByText('fase login')).toBeTruthy();
  });

  test('desconectar tira o Claude da lista', async () => {
    await abrir();
    await clicar(await screen.findByRole('button', { name: 'Conectar com o Claude: Conectado' }));
    await clicar(screen.getByRole('button', { name: 'Desconectar Claude' }));
    expect(screen.queryByRole('list', { name: 'Aplicativos conectados' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Conectar com o Claude: Conectar' })).toBeTruthy();
  });

  test('editar o nome grava na conta e muda o cabeçalho', async () => {
    const { repo, clock } = await criarContaDeExemplo();
    const atualizarConta = vi.fn(async () => undefined);
    const autenticacao: Autenticacao = {
      sessaoAtual: async () => ({ id: 'ex-user', nome: 'Ana', email: 'ana@exemplo.com' }),
      entrarComGoogle: async () => undefined,
      sair: async () => undefined,
      atualizarConta,
      rede: () => ({ baseUrl: 'https://api.exemplo.dev' }),
    };
    render(
      <AppProvider repoInicial={repo} relogioInicial={clock} autenticacao={autenticacao}>
        <SoPronto>
          <PerfilScreen />
        </SoPronto>
      </AppProvider>,
    );
    await clicar(await screen.findByRole('button', { name: 'Editar perfil' }));
    const dialogo = within(screen.getByRole('dialog', { name: 'Editar perfil' }));
    fireEvent.change(dialogo.getByLabelText('Nome'), { target: { value: 'Ana Lima' } });
    await clicar(dialogo.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ana Lima');
    expect(atualizarConta).toHaveBeenCalledWith({ nome: 'Ana Lima', foto: null });
    expect(screen.queryByRole('dialog')).toBeNull();
  });


});
