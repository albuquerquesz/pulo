import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect } from 'react';

import { RemoteError } from '@pulo/client';
import { HOUSE } from '@pulo/core/config/decisions';
import { verCasa } from '@pulo/core/domain/casa';
import type { Repository } from '@pulo/core/domain/types';

import { AppProvider, useApp, type AppValue } from '../app';
import { criarContaDeExemplo } from '../../testing/conta-de-exemplo';
import { IlhaScreen } from './IlhaScreen';

const navegar = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navegar }));

interface Abertura {
  saldo?: number;
  trocar?: (repo: Repository) => Repository;
  /** Abre com a casa de exemplo (pela metade). */
  comCasa?: boolean;
}

/** A Ilha com o saldo pedido; `trocar` muda o repositório antes de abrir. */
async function abrir({ saldo, trocar, comCasa = false }: Abertura = {}) {
  // Sem a casa de exemplo, só o quarto.
  const sessao = await criarContaDeExemplo(comCasa ? {} : { casa: [] });
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
  // A primeira renderização da Ilha é pesada: no CI passa de 1 s, o limite padrão do findBy.
  await screen.findByRole('list', { name: 'Partes da casa' }, { timeout: 4000 });
  return { repo, saldo: async () => (await verCasa(repo)).saldo, app: () => app };
}

const aba = async (nome: 'Cômodos' | 'Estrutura' | 'Exterior') => {
  await act(async () => {
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(nome) }));
  });
};
const contador = (nome: 'Cômodos' | 'Estrutura' | 'Exterior') => screen.getByRole('tab', { name: new RegExp(nome) }).textContent;

/** A parte pronta vira um selo (imagem), não um botão. */
const pronta = (nome: RegExp) => within(screen.getByRole('list', { name: 'Partes da casa' })).getByRole('img', { name: nome });
const parte = (nome: RegExp) => within(screen.getByRole('list', { name: 'Partes da casa' })).getByRole('button', { name: nome });
const desligado = (el: HTMLElement) => el.hasAttribute('disabled');
const noTopo = () => screen.getByText('joias', { exact: false, selector: 'span.sr-only' }).closest('b')?.textContent;
const naCena = (id: string) => screen.getByRole('img', { name: 'Sua ilha' }).querySelector(`[data-parte="${id}"]`);

const confirm = vi.fn(() => true);

beforeEach(() => {
  navegar.mockClear();
  confirm.mockReset().mockReturnValue(true);
  vi.stubGlobal('confirm', confirm);
});
afterEach(() => vi.unstubAllGlobals());

describe('Ilha', () => {
  test('mostra o saldo, o contador e só o quarto pronto', async () => {
    const { saldo } = await abrir();
    expect(noTopo()).toBe(`${await saldo()} joias`);
    expect(screen.getByText('1 de 24')).toBeTruthy();
    await aba('Cômodos');
    expect(pronta(/Quarto, pronta/)).toBeTruthy();
    expect(naCena('quarto')?.classList.contains('feita')).toBe(true);
    expect(naCena('cerca')?.classList.contains('feita')).toBe(false);
    expect(screen.queryByTestId('fumaca')).toBeNull();
  });

  test('as abas filtram as partes e contam cada camada', async () => {
    await abrir({ saldo: 0 });
    await aba('Estrutura');
    expect(within(screen.getByRole('list', { name: 'Partes da casa' })).getAllByRole('button')).toHaveLength(4);
    expect(contador('Estrutura')).toBe('Estrutura0/4');
    await aba('Exterior');
    expect(within(screen.getByRole('list', { name: 'Partes da casa' })).getAllByRole('button')).toHaveLength(12);
    expect(contador('Cômodos')).toBe('Cômodos1/8');
  });

  test('comprar desconta o saldo, muda o contador da camada e a parte cai', async () => {
    const { repo, saldo } = await abrir({ saldo: 100 });
    await aba('Exterior');
    await act(async () => {
      fireEvent.click(parte(/Cerca/));
    });
    await screen.findByText('2 de 24');
    expect(contador('Exterior')).toBe('Exterior1/12');
    expect(await saldo()).toBe(100 - HOUSE.partCost.cerca);
    expect(noTopo()).toBe(`${100 - HOUSE.partCost.cerca} joias`);
    expect(naCena('cerca')?.getAttribute('class')).toBe('parte-da-casa feita nova');
    expect(pronta(/Cerca, pronta/)).toBeTruthy();
    expect((await repo.listHousePurchases()).map((c) => c.item)).toEqual(['cerca']);
  });

  test('com Web Animations, as joias voam e a parte cai no fim com o saldo certo', async () => {
    const animate = vi.fn(() => ({ finished: Promise.resolve() }));
    Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate });
    Object.defineProperty(SVGElement.prototype, 'getBBox', { configurable: true, value: () => ({ x: 0, y: 0, width: 40, height: 40 }) });
    try {
      await abrir({ saldo: 100 });
      await aba('Exterior');
      await act(async () => {
        fireEvent.click(parte(/Cerca/));
      });
      await screen.findByText('2 de 24', {}, { timeout: 4000 });
      await waitFor(() => expect(noTopo()).toBe(`${100 - HOUSE.partCost.cerca} joias`), { timeout: 4000 });
      expect(animate).toHaveBeenCalled();
      expect(naCena('cerca')?.classList.contains('feita')).toBe(true);
      expect(document.querySelector('.joia-voando')).toBeNull();
    } finally {
      Reflect.deleteProperty(Element.prototype, 'animate');
      Reflect.deleteProperty(SVGElement.prototype, 'getBBox');
    }
  });

  test('comprar pede confirmação com o nome e o preço, e cancelar não gasta', async () => {
    const gravar = vi.fn();
    await abrir({ saldo: 100, trocar: (repo) => ({ ...repo, saveHousePurchase: gravar }) });
    await aba('Exterior');
    confirm.mockReturnValue(false);
    await act(async () => {
      fireEvent.click(parte(/Cerca/));
    });
    expect(confirm).toHaveBeenCalledWith(`Construir Cerca?\nCusta ${HOUSE.partCost.cerca} joias.`);
    expect(gravar).not.toHaveBeenCalled();
    expect(noTopo()).toBe('100 joias');
    expect(naCena('cerca')?.classList.contains('feita')).toBe(false);
  });

  test('a próxima parte que cabe no saldo ganha destaque', async () => {
    await abrir({ saldo: 30 });
    expect(parte(/Caixa de correio, 30 joias, próximo alvo/)).toBeTruthy();
  });

  test('parte sem saldo fica apagada e não grava', async () => {
    const gravar = vi.fn();
    await abrir({ saldo: 50, trocar: (repo) => ({ ...repo, saveHousePurchase: gravar }) });
    await aba('Cômodos');
    expect(desligado(parte(/Cozinha/))).toBe(true);
    fireEvent.click(parte(/Cozinha/));
    expect(gravar).not.toHaveBeenCalled();
  });

  test('parte trancada mostra o motivo e não chama o repositório', async () => {
    const gravar = vi.fn();
    await abrir({ saldo: 1000, trocar: (repo) => ({ ...repo, saveHousePurchase: gravar }) });
    await aba('Estrutura');
    const torre = parte(/Torre/);
    expect(torre.textContent).toContain('Precisa do Segundo andar');
    expect(torre.textContent).toContain('🔒');
    expect(desligado(torre)).toBe(true);
    fireEvent.click(torre);
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
    await aba('Exterior');
    await act(async () => {
      fireEvent.click(parte(/Cerca/));
    });
    await waitFor(() => expect(app()?.aviso?.mensagem).toBe(mensagem));
    expect(screen.getByText('1 de 24')).toBeTruthy();
    expect(naCena('cerca')?.classList.contains('feita')).toBe(false);
  });

  test('a chaminé comprada solta fumaça e o segundo andar comemora a conquista', async () => {
    const { app } = await abrir({ saldo: 1500 });
    await aba('Cômodos');
    for (const nome of [/Sala de estar/, /Cozinha/]) {
      await waitFor(() => expect(desligado(parte(nome))).toBe(false));
      await act(async () => {
        fireEvent.click(parte(nome));
      });
    }
    await aba('Estrutura');
    for (const nome of [/Chaminé/, /Segundo andar, /]) {
      await waitFor(() => expect(desligado(parte(nome))).toBe(false));
      await act(async () => {
        fireEvent.click(parte(nome));
      });
    }
    await screen.findByText('5 de 24');
    expect(screen.getByTestId('fumaca')).toBeTruthy();
    await waitFor(() => expect(app()?.aviso?.mensagem).toBe('Conquista nova: 🏘️ Dois andares'));
    expect(app()?.evento).toBe('comemorando');
  });

  test('a conta de exemplo mostra a casa pela metade', async () => {
    await abrir({ comCasa: true });
    expect(screen.getByText('12 de 24')).toBeTruthy();
    expect(screen.queryByTestId('sapo-na-janela')).toBeNull();
  });

  test('o cais da próxima ilha fica trancado e diz quanto falta', async () => {
    const { app } = await abrir({ comCasa: true });
    expect(screen.getByTestId('cadeado')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Caminho para a próxima ilha, trancado' }));
    expect(app()?.aviso?.mensagem).toBe('A próxima ilha abre com a casa inteira. Faltam 12 partes.');
  });

  test('o botão de canto e o + levam para a Casa', async () => {
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar em casa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ganhar mais' }));
    expect(navegar).toHaveBeenCalledTimes(2);
    expect(navegar).toHaveBeenCalledWith({ to: '/casa' });
  });
});
