import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';

import { RemoteError } from '@pulo/client';
import { GELO } from '@pulo/core/config/decisions';
import { verCasa } from '@pulo/core/domain/casa';
import { providesFreezeStore } from '@pulo/core/domain/gelo-store';

import { AppProvider, useApp, type AppValue } from '../app';
import { criarSessaoDemo, type SessaoDemo } from '../app/demo';
import { comAvisosDeErro } from '../app/repositorio';
import { Casca } from './Casca';
import { MENSAGENS_DE_ERRO } from './erros';
import { DURACAO_DO_AVISO_DO_GELO_MS, textoDeDescansos, textoDoAvisoDoGelo } from './gelo';

type LinkFalso = { to: string; children: ReactNode; className?: string; 'aria-label'?: string };
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children, ...resto }: LinkFalso) => (
    <a href={to} {...resto}>
      {children}
    </a>
  ),
}));

describe('textos do gelo e do descanso', () => {
  test('descansos que restam', () => {
    expect(textoDeDescansos(2, 2)).toBe('Restam 2 descansos nesta semana');
    expect(textoDeDescansos(1, 2)).toBe('Resta 1 descanso nesta semana');
    expect(textoDeDescansos(0, 2)).toBe('Você já usou os 2 descansos desta semana');
  });

  test('aviso para 1 e 2 dias', () => {
    expect(textoDoAvisoDoGelo(['2026-11-20'], '2026-11-21')).toBe('O gelo segurou seu foguinho ontem.');
    expect(textoDoAvisoDoGelo(['2026-11-18'], '2026-11-21')).toBe('O gelo segurou seu foguinho em 18/11.');
    expect(textoDoAvisoDoGelo(['2026-11-19', '2026-11-20'], '2026-11-21')).toBe('2 gelos seguraram seu foguinho em 19/11 e 20/11.');
  });

  test('a recusa da API vira o texto da tela', async () => {
    const { repo } = await criarSessaoDemo();
    const avisar = vi.fn();
    vi.spyOn(repo, 'saveRestDay').mockRejectedValue(new RemoteError({ kind: 'api', code: 'limite_de_descanso', mensagem: 'outra' }));
    const comAvisos = comAvisosDeErro(repo, { avisar, sessaoExpirou: vi.fn() });
    await expect(comAvisos.saveRestDay({ date: '2026-11-21' })).rejects.toBeTruthy();
    expect(avisar).toHaveBeenCalledWith(MENSAGENS_DE_ERRO.limite_de_descanso);
  });
});

/** O demo com os gelos pedidos: compras a mais e dias protegidos ainda não vistos. */
async function sessaoComGelo({ compras = 0, naoVistos = [] }: { compras?: number; naoVistos?: string[] } = {}) {
  const sessao = await criarSessaoDemo();
  const { repo } = sessao;
  if (!providesFreezeStore(repo)) throw new Error('o demo guarda gelo');
  for (let i = 0; i < compras; i += 1) await repo.saveFreezePurchase({ item: `gelo-teste-${i}`, cost: 0, createdAt: 0 });
  await repo.saveFreezeUses(naoVistos.map((date) => ({ date })));
  return { ...sessao, gelos: repo };
}

async function abrir({ repo, clock }: SessaoDemo) {
  let app: AppValue | undefined;
  function Sonda() {
    const valor = useApp();
    useEffect(() => {
      app = valor;
    });
    return valor.fase === 'pronto' ? <Casca caminho="/">conteúdo</Casca> : null;
  }
  render(
    <AppProvider repoInicial={repo} relogioInicial={clock} demoNaAbertura={false}>
      <Sonda />
    </AppProvider>,
  );
  await screen.findByRole('button', { name: /Gelos guardados/ });
  return () => app;
}

const clicar = (elemento: HTMLElement) => act(async () => void fireEvent.click(elemento));

const abrirLoja = async () => {
  await clicar(screen.getByRole('button', { name: /Gelos guardados/ }));
  const loja = within(screen.getByRole('dialog', { name: 'Loja de gelo' }));
  await loja.findByRole('region', { name: 'Gelo' });
  return loja;
};

describe('gelo na casca', () => {
  afterEach(() => vi.useRealTimers());

  test('comprar desconta as joias e sobe o contador', async () => {
    const sessao = await sessaoComGelo();
    const antes = (await verCasa(sessao.repo)).saldo;
    expect(antes).toBeGreaterThanOrEqual(GELO.preco);
    await abrir(sessao);
    expect(screen.getByRole('button', { name: /Gelos guardados: 0 de 2/ })).toBeTruthy();
    const loja = await abrirLoja();
    await clicar(loja.getByRole('button', { name: `Comprar gelo por ${GELO.preco} joias` }));
    expect(await loja.findByText('Você tem 1 de 2')).toBeTruthy();
    expect((await verCasa(sessao.repo)).saldo).toBe(antes - GELO.preco);
    expect(await screen.findByRole('button', { name: /Gelos guardados: 1 de 2/ })).toBeTruthy();
  });

  test('no máximo o botão fica desligado, com o motivo, e não compra', async () => {
    // O demo já usou um gelo: o presente mais duas compras menos um uso dá o máximo.
    const sessao = await sessaoComGelo({ compras: 2 });
    await abrir(sessao);
    const loja = await abrirLoja();
    const botao = loja.getByRole('button', { name: /Comprar gelo/ });
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(loja.getByText('Você já guarda 2 gelos, que é o máximo.')).toBeTruthy();
    await clicar(botao);
    expect(await sessao.gelos.listFreezePurchases()).toHaveLength(2);
  });

  test('o aviso aparece uma vez, some ao tocar e conta como visto', async () => {
    const sessao = await sessaoComGelo({ naoVistos: ['2026-11-20'] });
    const app = await abrir(sessao);
    await clicar(await screen.findByRole('button', { name: 'O gelo segurou seu foguinho ontem.' }));
    expect((await sessao.gelos.listFreezeUses()).every((uso) => uso.vistoEm !== undefined)).toBe(true);
    await act(async () => app()?.refresh());
    expect(screen.queryByText('O gelo segurou seu foguinho ontem.')).toBeNull();
  });

  test('o aviso some sozinho', async () => {
    const sessao = await sessaoComGelo({ naoVistos: ['2026-11-20'] });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await abrir(sessao);
    await screen.findByText('O gelo segurou seu foguinho ontem.');
    await act(async () => void (await vi.advanceTimersByTimeAsync(DURACAO_DO_AVISO_DO_GELO_MS)));
    expect(screen.queryByText('O gelo segurou seu foguinho ontem.')).toBeNull();
    expect((await sessao.gelos.listFreezeUses()).every((uso) => uso.vistoEm !== undefined)).toBe(true);
  });
});
