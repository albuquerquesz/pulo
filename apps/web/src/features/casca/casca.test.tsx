import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';

import type { Clock, Repository } from '@pulo/core/domain/types';

import { AppProvider, useApp } from '../app';
import { criarSessaoDemo } from '../app/demo';
import { ladoDoConteudo } from '../app/useLargura';
import { Casca } from './Casca';

type LinkFalso = { to: string; children: ReactNode; className?: string; 'aria-label'?: string; 'aria-current'?: 'page' };
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children, ...resto }: LinkFalso) => (
    <a href={to} {...resto}>
      {children}
    </a>
  ),
}));

const consultaPadrao = window.matchMedia;
function telaLarga(larga: boolean) {
  window.matchMedia = (consulta) => ({ ...consultaPadrao(consulta), matches: larga && consulta.includes('min-width') });
}
afterEach(() => {
  window.matchMedia = consultaPadrao;
});

function MarcarHabito({ repo, clock }: { repo: Repository; clock: Clock }) {
  const { refresh } = useApp();
  const marcar = async () => {
    await repo.saveHabitLog({ habitId: 'demo-habito-ler', date: '2026-11-21', doneAt: clock.now() });
    refresh();
  };
  return <button onClick={() => void marcar()}>marcar</button>;
}

async function abrir(caminho: string, larga = true) {
  telaLarga(larga);
  const { repo, clock } = await criarSessaoDemo();
  render(
    <AppProvider repoInicial={repo} relogioInicial={clock} demoNaAbertura={false}>
      <SoPronto>
        <Casca caminho={caminho}>
          <MarcarHabito repo={repo} clock={clock} />
        </Casca>
      </SoPronto>
    </AppProvider>,
  );
  await screen.findByRole('navigation', { name: 'Principal' });
}

function SoPronto({ children }: { children: ReactNode }) {
  return useApp().fase === 'pronto' ? children : null;
}

describe('Casca', () => {
  test('menu na ordem do rascunho, com a aba atual marcada', async () => {
    await abrir('/habitos');
    const links = within(screen.getByRole('navigation', { name: 'Principal' })).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Hoje', 'Ilha', 'Tarefas', 'Hábitos', 'Metas']);
    expect(links.filter((l) => l.getAttribute('aria-current') === 'page').map((l) => l.textContent)).toEqual(['Hábitos']);
    expect(screen.getByRole('link', { name: 'Abrir perfil' }).getAttribute('href')).toBe('/perfil');
  });

  test('o trilho mostra os números do repositório e muda na hora', async () => {
    await abrir('/');
    const habitos = await screen.findByRole('group', { name: 'hábitos feitos hoje' });
    expect(habitos.textContent).toBe('2/4');
    expect(screen.getByRole('group', { name: 'minutos de foco hoje' }).textContent).toBe('50');
    expect(screen.getByText('12 de 24 partes')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Focar' }).getAttribute('href')).toBe('/casa');
    expect(screen.getByRole('progressbar', { name: 'Terminar o curso de inglês' }).textContent).toBe('3 / 5');
    expect(screen.getByRole('img', { name: 'Baú aberto' })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByText('marcar'));
    });
    expect(await screen.findByText('3/4')).toBeTruthy();
  });

  test.each(['/casa', '/ilha', '/tarefas'])('sem trilho em %s', async (caminho) => {
    await abrir(caminho);
    expect(screen.queryByRole('complementary', { name: 'Seu dia' })).toBeNull();
    expect(screen.queryByTestId('numeros-do-dia')).toBeNull();
  });

  test('na página de metas o trilho não repete as metas', async () => {
    await abrir('/metas');
    await screen.findByTestId('numeros-do-dia');
    expect(screen.queryByRole('region', { name: 'Metas' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Sua casa' })).toBeTruthy();
  });

  test('no celular o que é do trilho entra no Hoje, uma vez só', async () => {
    await abrir('/', false);
    expect(await screen.findAllByTestId('numeros-do-dia')).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Sua casa' })).toBeTruthy();
    expect(screen.queryByRole('complementary', { name: 'Seu dia' })).toBeNull();
  });

  test('no celular as outras telas ficam só com o conteúdo', async () => {
    await abrir('/habitos', false);
    expect(screen.queryByTestId('numeros-do-dia')).toBeNull();
  });
});

describe('lado do desenho na coluna do meio', () => {
  test('cabe no celular e entre a barra lateral e o trilho', () => {
    expect([375, 768, 1280, 1920].map(ladoDoConteudo)).toEqual([343, 376, 428, 544]);
  });
});

describe('a moeda é a joia', () => {
  test('nenhum texto da interface fala em moscas', () => {
    const raiz = join(process.cwd(), 'src');
    const comMoscas = readdirSync(raiz, { recursive: true, encoding: 'utf8' })
      .filter((arquivo) => /\.(ts|tsx|css)$/.test(arquivo) && !/\.test\./.test(arquivo))
      .filter((arquivo) => /mosca/i.test(readFileSync(join(raiz, arquivo), 'utf8')));
    expect(comMoscas).toEqual([]);
  });
});
