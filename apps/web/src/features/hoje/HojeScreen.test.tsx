import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';

import { AppProvider, useApp } from '../app';
import { criarSessaoDemo } from '../app/demo';
import { HojeScreen } from './HojeScreen';

type LinkFalso = { to: string; search?: object; children: ReactNode; className?: string; 'aria-label'?: string };
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, search, children, ...resto }: LinkFalso) => (
    <a href={search ? `${to}?${new URLSearchParams({ ...search })}` : to} {...resto}>
      {children}
    </a>
  ),
}));

function SoPronto({ children }: { children: ReactNode }) {
  return useApp().fase === 'pronto' ? children : null;
}

async function abrir() {
  const { repo, clock } = await criarSessaoDemo();
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

const regiao = (nome: string) => within(screen.getByRole('region', { name: nome }));

describe('Tela Hoje', () => {
  test('blocos na ordem do rascunho', async () => {
    await abrir();
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titulos).toEqual(['Sequência', 'Esta semana', 'Hábitos de hoje', 'Tarefas de hoje', 'Linha do dia']);
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
});
