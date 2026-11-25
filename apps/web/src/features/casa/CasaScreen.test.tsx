import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect } from 'react';

import { verCasa } from '@pulo/core/domain/casa';

import { AppProvider, useApp, type AppValue } from '../app';
import { criarSessaoDemo } from '../app/demo';
import type { VinculoDaCasa } from '../foco/vinculo';
import { CasaScreen } from './CasaScreen';

const navegar = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navegar }));

/** `demo`: o app abre no modo demo de verdade; senão, o repositório do demo entra como se fosse a conta. */
async function abrir(vinculo?: VinculoDaCasa, demo = true) {
  const conta = demo ? null : await criarSessaoDemo();
  const onComecou = vi.fn();
  let app: AppValue | undefined;
  function Sonda() {
    const valor = useApp();
    useEffect(() => {
      app = valor;
    });
    return valor.fase === 'pronto' ? <CasaScreen vinculo={vinculo} onComecou={onComecou} /> : null;
  }
  render(
    <AppProvider repoInicial={conta?.repo} relogioInicial={conta?.clock} demoNaAbertura={demo}>
      <Sonda />
    </AppProvider>,
  );
  await screen.findByRole('button', { name: 'Ganhar mais' });
  await waitFor(() => expect(app?.fase).toBe('pronto'));
  if (!app) throw new Error('app não abriu');
  const { repo } = app;
  const saldo = async () => (await verCasa(repo)).saldo;
  // O saldo aparece quando o quarto carregou.
  await screen.findByText(String(await saldo()), { selector: 'b' });
  return { repo, saldo, onComecou };
}

/** Passa o tempo do relógio e dos intervalos (com os relógios falsos ligados). */
const avancar = async (minutos: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(minutos * 60_000);
  });
};

const clicar = async (nome: string | RegExp, dentro: Pick<typeof screen, 'getByRole'> = screen) => {
  await act(async () => {
    fireEvent.click(dentro.getByRole('button', { name: nome }));
  });
};
const noMostrador = () => screen.getByTestId('minutos').textContent;

beforeEach(() => {
  navegar.mockClear();
});

describe('Casa', () => {
  test('o timer anda de 5 em 5 entre os limites, e Voltar não grava nada', async () => {
    const { repo } = await abrir();
    const antes = (await repo.listSessions()).length;
    await clicar('Focar!');
    expect(noMostrador()).toBe('25');
    await clicar('Mais 5 minutos');
    expect(noMostrador()).toBe('30');
    fireEvent.change(screen.getByRole('slider', { name: 'Minutos de foco' }), { target: { value: '50' } });
    await clicar('Mais 5 minutos');
    expect(noMostrador()).toBe('50');
    await clicar('Voltar');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await repo.listSessions()).toHaveLength(antes);
  });

  test('o vínculo da URL vai para a sessão, com o bloco', async () => {
    const { repo, onComecou } = await abrir({ bloco: 'demo-bloco-ingles', habito: 'demo-habito-ingles' });
    await clicar('Focar!');
    const para = within(screen.getByRole('group', { name: 'Para' }));
    expect(para.getByRole('button', { name: 'Estudar inglês' }).getAttribute('aria-pressed')).toBe('true');
    await clicar('Começar');
    const aberta = (await repo.listSessions()).find((s) => s.state === 'em_andamento');
    expect(aberta).toMatchObject({ plannedMinutes: 25, blockId: 'demo-bloco-ingles', habitId: 'demo-habito-ingles' });
    expect(onComecou).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Parar' })).toBeTruthy();
  });

  test('foco: +1 a cada 5 minutos, sem contagem na tela, e termina sozinho', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { repo, saldo } = await abrir();
      const antes = await saldo();
      await clicar('Focar!');
      fireEvent.change(screen.getByRole('slider'), { target: { value: '15' } });
      await clicar('Livre', within(screen.getByRole('group', { name: 'Para' })));
      await clicar('Começar');
      expect(screen.queryByTestId('minutos')).toBeNull();
      await avancar(5);
      expect(screen.getByTestId('ganho').textContent).toBe('+1');
      expect(screen.getByText(String(antes + 1), { selector: 'b' })).toBeTruthy();
      await avancar(11);
      expect(await screen.findByRole('button', { name: 'Focar!' })).toBeTruthy();
      expect((await repo.listSessions()).filter((s) => s.state === 'em_andamento')).toEqual([]);
      expect(await saldo()).toBe(antes + 3);
    } finally {
      vi.useRealTimers();
    }
  });

  test('Parar encerra antes da hora', async () => {
    const { repo } = await abrir();
    await clicar('Focar!');
    await clicar('Começar');
    await clicar('Parar');
    expect((await repo.listSessions()).some((s) => s.state === 'interrompida')).toBe(true);
    expect(screen.getByRole('button', { name: 'Focar!' })).toBeTruthy();
  });

  test('decorar: Cancelar não grava; Ver no quarto e Comprar colocam o item e descontam o saldo', async () => {
    const { repo, saldo } = await abrir();
    expect(await repo.listRoomDecor()).toEqual([]);
    const antes = await saldo();
    await clicar('Decorar');
    expect(screen.getByText(/para decorar o quarto do Pulo/)).toBeTruthy();
    await clicar('Decorar: parede esquerda, primeiro lugar');
    await clicar('Cancelar');
    expect(await repo.listRoomDecor()).toEqual([]);

    await clicar('Decorar: parede esquerda, primeiro lugar');
    await clicar('Relógio', within(screen.getByRole('group', { name: 'Tipo de item' })));
    await clicar('Ver no quarto');
    expect(screen.getByTestId('item-p1')).toBeTruthy();
    expect(await repo.listRoomDecor()).toEqual([]);
    await clicar(/Comprar/, within(screen.getByRole('group', { name: 'Prévia no quarto' })));
    expect(screen.getByTestId('item-p1').getAttribute('aria-label')).toBe('Relógio, Natural');
    expect(await screen.findByText(String(antes - 20), { selector: 'b' })).toBeTruthy();

    await clicar('Decorar: parede esquerda, primeiro lugar');
    expect(screen.getByRole('button', { name: 'No lugar' })).toBeTruthy();
    await clicar('Tirar daqui');
    expect(screen.queryByTestId('item-p1')).toBeNull();

    await clicar('Pronto');
    expect(screen.queryByRole('button', { name: /^Decorar:/ })).toBeNull();
  });

  test('na conta, só dá para comprar o que a API vende', async () => {
    await abrir(undefined, false);
    await clicar('Decorar');
    await clicar('Decorar: chão, primeiro lugar');
    await clicar('Cama', within(screen.getByRole('group', { name: 'Tipo de item' })));
    expect(screen.getByRole('button', { name: 'Em breve' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Rosa, em breve' })).toBeTruthy();
  });

  test('a loja de canto abre sem lugar, e Sair de casa vai para a Ilha', async () => {
    await abrir();
    await clicar('Loja');
    expect(screen.getByRole('dialog', { name: 'Loja do quarto' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ver no quarto' })).toBeNull();
    await clicar('Cancelar');
    await clicar('Sair de casa');
    expect(navegar).toHaveBeenCalledWith({ to: '/ilha' });
  });
});
