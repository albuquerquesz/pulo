import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { Repository } from '@pulo/core/domain/types';

import { AppProvider, useApp } from '../app';
import { criarSessaoDemo } from '../app/demo';
import { HojeScreen } from './HojeScreen';

type LinkFalso = { to: string; search?: object; hash?: string; children: ReactNode; className?: string; 'aria-label'?: string };
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, search, hash, children, ...resto }: LinkFalso) => (
    <a href={`${to}${search ? `?${new URLSearchParams({ ...search })}` : ''}${hash ? `#${hash}` : ''}`} {...resto}>
      {children}
    </a>
  ),
}));

function SoPronto({ children }: { children: ReactNode }) {
  const { fase, aviso } = useApp();
  return fase === 'pronto' ? (
    <>
      {children}
      <p data-testid="aviso">{aviso?.mensagem}</p>
    </>
  ) : null;
}

/** `dias`: quanto o relógio anda depois do sábado do rascunho. Domingo (1) começa a semana sem nenhum cuidado. */
async function abrir({ dias = 0, preparar }: { dias?: number; preparar?: (repo: Repository) => Promise<void> } = {}) {
  const { repo, clock } = await criarSessaoDemo();
  clock.advanceDays(dias);
  await preparar?.(repo);
  render(
    <AppProvider repoInicial={repo} relogioInicial={clock} demoNaAbertura={false}>
      <SoPronto>
        <HojeScreen />
      </SoPronto>
    </AppProvider>,
  );
  await screen.findByRole('region', { name: 'Próximo foco' });
  return { repo };
}

const clicar = (elemento: HTMLElement) => act(async () => void fireEvent.click(elemento));

const regiao = (nome: string) => within(screen.getByRole('region', { name: nome }));

describe('Tela Hoje', () => {
  test('blocos na ordem do rascunho', async () => {
    await abrir();
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titulos).toEqual(['Sequência', 'Esta semana', 'Hábitos de hoje', 'Seu mês', 'Tarefas de hoje', 'Linha do dia']);
    expect(regiao('Tarefas de hoje').getByRole('link', { name: 'Ver quadro' }).getAttribute('href')).toBe('/tarefas');
  });

  test('Começar foco e Focar levam à Casa com o vínculo', async () => {
    await abrir();
    const destino = '/casa?bloco=demo-bloco-ingles&habito=demo-habito-ingles';
    expect(screen.getByRole('link', { name: '▶ Começar foco' }).getAttribute('href')).toBe(destino);
    expect(screen.getByRole('link', { name: 'Focar em Estudar inglês' }).getAttribute('href')).toBe(destino);
  });

  test('marcar hábito atualiza a tela e o repositório', async () => {
    const { repo } = await abrir();
    await act(async () => {
      fireEvent.click(regiao('Hábitos de hoje').getByRole('checkbox', { name: 'Ler 10 páginas' }));
    });
    expect(await regiao('Hábitos de hoje').findByText('3 de 4')).toBeTruthy();
    expect((await repo.listHabitLogs()).some((r) => r.habitId === 'demo-habito-ler' && r.date === '2026-11-21')).toBe(true);
  });

  test('concluir tarefa atualiza a tela e o repositório', async () => {
    const { repo } = await abrir();
    const nome = 'Concluir Exercícios da unidade 4';
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: nome }));
    });
    expect(screen.getByRole('checkbox', { name: nome }).getAttribute('aria-checked')).toBe('true');
    expect((await repo.listTasks()).find((t) => t.id === 'demo-tarefa-2')?.status).toBe('feito');
  });

  test('Descansar hoje grava, muda o dia na barra e desfaz', async () => {
    const { repo } = await abrir({ dias: 1 });
    await clicar(screen.getByRole('button', { name: 'Descansar hoje' }));
    expect(await regiao('Sequência').findByText('domingo, descanso')).toBeTruthy();
    expect((await repo.listRestDays()).map((r) => r.date)).toContain('2026-11-22');
    await clicar(screen.getByRole('button', { name: 'Desmarcar descanso de hoje' }));
    expect(await regiao('Sequência').findByText('domingo, hoje')).toBeTruthy();
    expect((await repo.listRestDays()).map((r) => r.date)).not.toContain('2026-11-22');
  });

  test('no limite da semana mostra a mensagem e nada muda', async () => {
    const { repo } = await abrir({
      preparar: async (r) => {
        await r.saveRestDay({ date: '2026-11-16' });
        await r.saveRestDay({ date: '2026-11-17' });
      },
    });
    const antes = await repo.listRestDays();
    await clicar(screen.getByRole('button', { name: 'Descansar hoje' }));
    expect(screen.getByTestId('aviso').textContent).toBe('Você já usou os 2 descansos desta semana.');
    expect(regiao('Sequência').getByText('sábado, hoje')).toBeTruthy();
    expect(await repo.listRestDays()).toEqual(antes);
  });

  test('a recusa do servidor desfaz o que a tela adiantou', async () => {
    await abrir({ dias: 1, preparar: async (r) => void vi.spyOn(r, 'saveRestDay').mockRejectedValue(new Error('recusado')) });
    await clicar(screen.getByRole('button', { name: 'Descansar hoje' }));
    expect(await regiao('Sequência').findByRole('button', { name: 'Descansar hoje' })).toBeTruthy();
    expect(regiao('Sequência').getByText('domingo, hoje')).toBeTruthy();
  });

  test('Seu mês mostra os três números e leva às métricas', async () => {
    await abrir();
    expect(regiao('Seu mês').getByRole('link', { name: 'Ver métricas' }).getAttribute('href')).toBe('/perfil#metricas');
    expect(await regiao('Seu mês').findByText('dias de cuidado')).toBeTruthy();
    await waitFor(() => expect(regiao('Seu mês').queryByText('…')).toBeNull());
  });
});
