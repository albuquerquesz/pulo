import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { Repository } from '@pulo/core/domain/types';

import { AppProvider, useApp } from '../app';
import { temConta, temPreferencias, type FonteDaConta, type FonteDePreferencias } from '../app/conta';
import { criarSessaoDemo } from '../app/demo';
import { PerfilScreen } from './PerfilScreen';

type RepoDoPerfil = Repository & FonteDaConta & FonteDePreferencias;

function SoPronto({ children }: { children: ReactNode }) {
  const { fase } = useApp();
  return fase === 'pronto' ? children : <p>fase {fase}</p>;
}

async function abrir() {
  const sessao = await criarSessaoDemo();
  if (!temConta(sessao.repo) || !temPreferencias(sessao.repo)) throw new Error('o demo precisa de conta e preferências');
  const repo: RepoDoPerfil = sessao.repo;
  render(
    <AppProvider repoInicial={repo} relogioInicial={sessao.clock} demoNaAbertura={false}>
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
    expect(screen.getByRole('group', { name: 'Seu sapo' }).textContent).toContain('Fase');
    expect(screen.getByText('Continue cuidando do sapo')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Mês de fogo' }).getAttribute('aria-valuenow')).toBe('21');
  });

  test('quem chega por #metricas cai na seção Métricas', async () => {
    window.location.hash = '#metricas';
    await abrir();
    await screen.findByRole('heading', { name: 'Ritmo' });
    expect(document.activeElement?.id).toBe('metricas');
    expect(screen.getByRole('heading', { name: 'Descanso e gelo' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Concluído' })).toBeTruthy();
    window.location.hash = '';
  });

  test('mudar preferência grava na conta', async () => {
    const repo = await abrir();
    await clicar(screen.getByRole('switch', { name: 'Sons do sapo' }));
    await clicar(screen.getByRole('switch', { name: 'Modo férias' }));
    await act(async () => void fireEvent.change(screen.getByRole('combobox', { name: 'Duração do foco' }), { target: { value: '40' } }));
    const preferencias = await repo.getPreferences();
    expect(preferencias).toMatchObject({ sounds: false, focusMinutes: 40, vacation: { ligado: true } });
    expect(screen.getByRole('switch', { name: 'Sons do sapo' }).getAttribute('aria-checked')).toBe('false');
  });

  test('tema e começo do dia vão para o usuário', async () => {
    const repo = await abrir();
    await clicar(screen.getByRole('button', { name: 'Escuro' }));
    await act(async () => void fireEvent.change(screen.getByRole('combobox', { name: 'Meu dia começa' }), { target: { value: '480' } }));
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
    expect(screen.getByText('Nenhum aplicativo conectado.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Conectar com o Claude: Conectar' })).toBeTruthy();
  });

  test('no demo, editar o nome muda o cabeçalho', async () => {
    render(
      <AppProvider demoNaAbertura>
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
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('a foto precisa ser https', async () => {
    await abrir();
    await clicar(screen.getByRole('button', { name: 'Editar perfil' }));
    const dialogo = within(screen.getByRole('dialog', { name: 'Editar perfil' }));
    fireEvent.change(dialogo.getByLabelText('Endereço da foto (https)'), { target: { value: 'http://exemplo.com/a.png' } });
    await clicar(dialogo.getByRole('button', { name: 'Salvar' }));
    expect(dialogo.getByRole('alert').textContent).toContain('https');
  });

  test('baixar gera o arquivo com os dados', async () => {
    const repo = await abrir();
    const exportar = vi.spyOn(repo, 'exportData');
    URL.createObjectURL = vi.fn(() => 'blob:dados');
    URL.revokeObjectURL = vi.fn();
    const baixado = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await clicar(screen.getByRole('button', { name: 'Baixar meus dados' }));
    expect(exportar).toHaveBeenCalled();
    expect(baixado).toHaveBeenCalled();
    baixado.mockRestore();
  });
});
