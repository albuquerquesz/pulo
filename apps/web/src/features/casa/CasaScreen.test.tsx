import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect } from 'react';

import { verCasa } from '@pulo/core/domain/casa';

import { AppProvider, useApp, type AppValue } from '../app';
import { criarContaDeExemplo } from '../../testing/conta-de-exemplo';
import type { VinculoDaCasa } from '../foco/vinculo';
import { CasaScreen } from './CasaScreen';

const navegar = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navegar }));

/** A conta de exemplo entra como se viesse do servidor. */
async function abrir(vinculo?: VinculoDaCasa) {
  const conta = await criarContaDeExemplo({ aoVivo: true });
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
    <AppProvider repoInicial={conta.repo} relogioInicial={conta.clock}>
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
const noModelo = () => within(screen.getByRole('group', { name: 'Modelo' }));
const noLugares = () => within(screen.getByRole('group', { name: 'Lugares do quarto' }));
const noMostrador = () => screen.getByTestId('minutos').textContent;

beforeEach(() => {
  navegar.mockClear();
  window.localStorage.clear();
});

describe('Casa', () => {
  test('o timer anda de 5 em 5 entre os limites, e fechar não grava nada', async () => {
    const { repo } = await abrir();
    const antes = (await repo.listSessions()).length;
    await clicar('Focar!');
    expect(noMostrador()).toBe('25');
    await clicar('Mais 5 minutos');
    expect(noMostrador()).toBe('30');
    fireEvent.change(screen.getByRole('slider', { name: 'Minutos de foco' }), { target: { value: '50' } });
    await clicar('Mais 5 minutos');
    expect(noMostrador()).toBe('50');
    await clicar('Fechar');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await repo.listSessions()).toHaveLength(antes);
  });

  test('o vínculo da URL vai para a sessão, com o bloco', async () => {
    const { repo, onComecou } = await abrir({ bloco: 'ex-bloco-ingles', habito: 'ex-habito-ingles' });
    await clicar('Focar!');
    const para = within(screen.getByRole('group', { name: 'Para' }));
    expect(para.getByRole('button', { name: 'Estudar inglês' }).getAttribute('aria-pressed')).toBe('true');
    await clicar('Começar');
    const aberta = (await repo.listSessions()).find((s) => s.state === 'em_andamento');
    expect(aberta).toMatchObject({ plannedMinutes: 25, blockId: 'ex-bloco-ingles', habitId: 'ex-habito-ingles' });
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

  test('durante o foco, Loja e Decorar ficam desativados, com o motivo', async () => {
    await abrir();
    const botao = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });
    await clicar('Focar!');
    await clicar('Começar');
    for (const nome of ['Loja', 'Decorar']) {
      expect(botao(nome).disabled).toBe(true);
      expect(botao(nome).title).toBe('Disponível quando o foco acabar');
    }
    expect(screen.getByText('Disponível quando o foco acabar')).toBeTruthy();
    await clicar('Parar');
    for (const nome of ['Loja', 'Decorar']) expect(botao(nome).disabled).toBe(false);
    expect(screen.queryByText('Disponível quando o foco acabar')).toBeNull();
  });

  test('decorar: tocar mostra a prévia sem gravar; Comprar coloca o móvel e desconta o saldo; Tirar guarda', async () => {
    const { repo, saldo } = await abrir();
    expect(await repo.listRoomDecor()).toEqual([]);
    const antes = await saldo();
    await clicar('Decorar');
    expect(screen.getByText(/para decorar o quarto do Pulo/)).toBeTruthy();
    await clicar('Decorar: Quadro');
    await clicar('Fechar');
    expect(await repo.listRoomDecor()).toEqual([]);

    await clicar('Decorar: Quadro');
    expect(screen.queryByTestId('item-quadro')).toBeNull();
    await clicar('Retrato, 35 joias', noModelo());
    expect(screen.getByTestId('item-quadro').getAttribute('class')).toBe('previa');
    expect(await repo.listRoomDecor()).toEqual([]);
    await clicar(/Comprar/);
    expect(screen.getByTestId('item-quadro').getAttribute('aria-label')).toBe('Retrato, Natural');
    expect(screen.getByTestId('item-quadro').getAttribute('class')).toBeNull();
    expect(await screen.findByText(String(antes - 35), { selector: 'b' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'No lugar ✓' })).toHaveProperty('disabled', true);

    await clicar('Tirar');
    expect(screen.queryByTestId('item-quadro')).toBeNull();
    expect(await repo.listRoomDecor()).toMatchObject([{ item: 'quadro-retrato' }]);
    expect(screen.getByRole('button', { name: 'Colocar' })).toBeTruthy();

    await clicar('Fechar');
    await clicar('Pronto');
    expect(screen.queryByRole('button', { name: /^Decorar:/ })).toBeNull();
  });

  test('um móvel por lugar: o outro modelo tira o antigo, que continua seu', async () => {
    const { repo, saldo } = await abrir();
    const antes = await saldo();
    await clicar('Loja');
    await clicar('Quadro', noLugares());
    await clicar('Paisagem, 30 joias', noModelo());
    await clicar(/Comprar/);
    await clicar('Retrato, 35 joias', noModelo());
    await clicar(/Comprar/);
    expect(screen.getByTestId('item-quadro').getAttribute('aria-label')).toBe('Retrato, Natural');
    expect(await saldo()).toBe(antes - 65);
    await clicar('Paisagem, já é seu', noModelo());
    await clicar('Colocar');
    expect(screen.getByTestId('item-quadro').getAttribute('aria-label')).toBe('Paisagem, Natural');
    expect(await saldo()).toBe(antes - 65);
    expect(await repo.listRoomDecor()).toHaveLength(2);
  });

  test('com Web Animations, a compra anima e termina no quarto gravado', async () => {
    const animate = vi.fn(() => ({ finished: Promise.resolve() }));
    Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate });
    Object.defineProperty(SVGElement.prototype, 'getBBox', { configurable: true, value: () => ({ x: 0, y: 0, width: 40, height: 40 }) });
    try {
      const { saldo } = await abrir();
      const antes = await saldo();
      await clicar('Loja');
      await clicar('Simples, 40 joias', noModelo());
      await clicar(/Comprar/);
      await waitFor(() => expect(screen.getByRole('button', { name: 'No lugar ✓' })).toBeTruthy(), { timeout: 4000 });
      expect(animate).toHaveBeenCalled();
      expect(screen.getByTestId('item-cama').getAttribute('aria-label')).toBe('Simples, Natural');
      expect(screen.getByText(String(antes - 40), { selector: 'b' })).toBeTruthy();
      expect(document.querySelector('.joia-voando')).toBeNull();
    } finally {
      Reflect.deleteProperty(Element.prototype, 'animate');
      Reflect.deleteProperty(SVGElement.prototype, 'getBBox');
    }
  });

  test('o seletor mostra só os cômodos comprados e troca a decoração', async () => {
    const { repo } = await abrir();
    const seletor = () => within(screen.getByRole('group', { name: 'Cômodo' }));
    expect(seletor().getAllByRole('button').map((b) => b.textContent)).toEqual(['🛏️Quarto', '🍳Cozinha', '🛋️Sala de estar', '🛁Banheiro']);

    await clicar('Decorar');
    await clicar('Decorar: Quadro');
    await clicar(/Comprar/);
    expect(screen.getByTestId('item-quadro')).toBeTruthy();
    await clicar('Fechar');

    await clicar(/Cozinha/, seletor());
    expect(screen.getByTestId('comodo').getAttribute('data-comodo')).toBe('cozinha');
    expect(screen.getByRole('group', { name: 'Cozinha do Pulo' })).toBeTruthy();
    expect(screen.getByText(/para decorar a cozinha do Pulo/)).toBeTruthy();
    expect(screen.queryByTestId('item-quadro')).toBeNull();

    // O mesmo móvel vem para a cozinha de graça e sai do quarto.
    await clicar('Decorar: Quadro');
    await clicar('Colocar');
    expect(screen.getByTestId('item-quadro')).toBeTruthy();
    expect(await repo.listRoomDecor()).toMatchObject([{ item: 'quadro-paisagem', comodo: 'cozinha' }]);
    await clicar('Fechar');
    await clicar(/Quarto/, seletor());
    expect(screen.queryByTestId('item-quadro')).toBeNull();
    expect(window.localStorage.getItem('pulo.comodo')).toBe('quarto');
  });

  test('modelos e cores têm preço na loja', async () => {
    await abrir();
    await clicar('Loja');
    expect(screen.getByRole('button', { name: 'Estofada, 60 joias' })).toBeTruthy();
    await clicar('Estofada, 60 joias', noModelo());
    expect(screen.getByRole('button', { name: 'Rosa, 60 joias' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Brilho, 70 joias' })).toBeTruthy();
  });

  test('a loja de canto abre na cama, e Sair de casa vai para a Ilha', async () => {
    await abrir();
    await clicar('Loja');
    expect(screen.getByRole('dialog', { name: 'Loja: Quarto' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cama', pressed: true })).toBeTruthy();
    await clicar('Fechar');
    await clicar('Sair de casa');
    expect(navegar).toHaveBeenCalledWith({ to: '/ilha' });
  });
});
