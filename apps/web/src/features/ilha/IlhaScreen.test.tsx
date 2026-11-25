import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect } from 'react';

import { RemoteError } from '@pulo/client';
import { HOUSE } from '@pulo/core/config/decisions';
import { verCasa } from '@pulo/core/domain/casa';
import type { Repository } from '@pulo/core/domain/types';

import { AppProvider, useApp, type AppValue } from '../app';
import { criarSessaoDemo } from '../app/demo';
import { IlhaScreen } from './IlhaScreen';

const navegar = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navegar }));

/** A Ilha sobre o repositório do demo com o saldo pedido; `trocar` muda o repositório antes de abrir. */
async function abrir({ saldo, trocar }: { saldo?: number; trocar?: (repo: Repository) => Repository } = {}) {
  const sessao = await criarSessaoDemo();
  if (saldo !== undefined) {
    const credito = (await sessao.repo.getJoiaCredit()) + saldo - (await verCasa(sessao.repo)).saldo;
    sessao.repo.getJoiaCredit = async () => credito;
  }
  const repo = trocar ? trocar(sessao.repo) : sessao.repo;
  let app: AppValue | undefined;
  function Sonda() {
    const valor = useApp();
    useEffect(() => {
      app = valor;
    });
    return valor.fase === 'pronto' ? <IlhaScreen /> : null;
  }
  render(
    <AppProvider repoInicial={repo} relogioInicial={sessao.clock}>
      <Sonda />
    </AppProvider>,
  );
  await screen.findByRole('list', { name: 'Partes da casa' });
  return { repo, saldo: async () => (await verCasa(repo)).saldo, app: () => app };
}

const parte = (nome: RegExp) => within(screen.getByRole('list', { name: 'Partes da casa' })).getByRole('button', { name: nome });
const desligado = (el: HTMLElement) => el.hasAttribute('disabled');
const noTopo = () => screen.getByText('joias', { exact: false, selector: 'span.sr-only' }).closest('b')?.textContent;
const naCena = (id: string) => screen.getByRole('img', { name: 'Sua ilha' }).querySelector(`[data-parte="${id}"]`);

beforeEach(() => navegar.mockClear());

describe('Ilha', () => {
  test('mostra o saldo, o contador e só o quarto pronto', async () => {
    const { saldo } = await abrir();
    expect(noTopo()).toBe(`${await saldo()} joias`);
    expect(screen.getByText('1 de 6')).toBeTruthy();
    expect(desligado(parte(/Quarto, pronta/))).toBe(true);
    expect(naCena('quarto')?.classList.contains('feita')).toBe(true);
    expect(naCena('cerca')?.classList.contains('feita')).toBe(false);
  });

  test('comprar desconta o saldo, muda o contador e a parte cai', async () => {
    const { repo, saldo } = await abrir({ saldo: 100 });
    await act(async () => {
      fireEvent.click(parte(/Cerca/));
    });
    await screen.findByText('2 de 6');
    expect(await saldo()).toBe(100 - HOUSE.partCost.cerca);
    expect(noTopo()).toBe(`${100 - HOUSE.partCost.cerca} joias`);
    expect(naCena('cerca')?.getAttribute('class')).toBe('parte-da-casa feita nova');
    expect(desligado(parte(/Cerca, pronta/))).toBe(true);
    expect((await repo.listHousePurchases()).map((c) => c.item)).toEqual(['cerca']);
  });

  test('parte sem saldo fica apagada e não grava', async () => {
    const gravar = vi.fn();
    await abrir({ saldo: 50, trocar: (repo) => ({ ...repo, saveHousePurchase: gravar }) });
    expect(desligado(parte(/Cozinha/))).toBe(true);
    fireEvent.click(parte(/Cozinha/));
    expect(gravar).not.toHaveBeenCalled();
  });

  test('a recusa por falta de joias mostra a mensagem e desfaz', async () => {
    const mensagem = 'Ainda faltam joias para isso.';
    const { app } = await abrir({
      saldo: 100,
      trocar: (repo) => ({
        ...repo,
        saveHousePurchase: async () => {
          throw new RemoteError({ kind: 'api', code: 'joias_insuficientes', status: 409, mensagem });
        },
      }),
    });
    await act(async () => {
      fireEvent.click(parte(/Cerca/));
    });
    await waitFor(() => expect(app()?.aviso?.mensagem).toBe(mensagem));
    expect(screen.getByText('1 de 6')).toBeTruthy();
    expect(naCena('cerca')?.classList.contains('feita')).toBe(false);
  });

  test('a última parte comemora a conquista', async () => {
    const { app } = await abrir({ saldo: 1000 });
    for (const nome of [/Cozinha/, /Varanda/, /Jardim/, /Árvore/, /Cerca/]) {
      await waitFor(() => expect(desligado(parte(nome))).toBe(false));
      await act(async () => {
        fireEvent.click(parte(nome));
      });
    }
    await screen.findByText('6 de 6');
    await waitFor(() => expect(app()?.aviso?.mensagem).toBe('Conquista nova: 🏡 Casa inteira'));
    expect(app()?.evento).toBe('feliz');
  });

  test('o botão de canto e o + levam para a Casa', async () => {
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar em casa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ganhar mais' }));
    expect(navegar).toHaveBeenCalledTimes(2);
    expect(navegar).toHaveBeenCalledWith({ to: '/casa' });
  });
});
