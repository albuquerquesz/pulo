jest.mock('react-native-reanimated', () => require('../../ui/testing/reanimated-mock'));

import { act } from 'react';
import { createRoot } from 'test-renderer';

import { RemoteError } from '@pulo/client';
import type { ProposalOutcome } from '@pulo/core/domain/ia';
import { DEFAULT_USER_METADATA } from '@pulo/core/domain/user-metadata';
import { TemaProvider } from '@/theme/useTheme';

import type { Autenticacao, PessoaLogada } from '../sessao/auth';
import { carregarSemana } from '../semana/logic';
import { AppProvider, useApp, type AppValue } from './AppProvider';

const PESSOA: PessoaLogada = { id: 'conta-1', nome: 'Ana', email: 'ana@example.com' };

interface Chamadas {
  sessao: number;
  sair: number;
  rede: string[];
}

function autenticacaoFalsa(opcoes: {
  sessao: () => Promise<PessoaLogada | null>;
  servidor?: (request: Request) => Response;
}): { auth: Autenticacao; chamadas: Chamadas } {
  const chamadas: Chamadas = { sessao: 0, sair: 0, rede: [] };
  const auth: Autenticacao = {
    sessaoAtual: () => {
      chamadas.sessao += 1;
      return opcoes.sessao();
    },
    entrarComGoogle: async () => undefined,
    sair: async () => void (chamadas.sair += 1),
    rede: () => ({
      baseUrl: 'http://api.test',
      fetch: (request) => {
        chamadas.rede.push(`${request.method} ${new URL(request.url).pathname}`);
        return opcoes.servidor ? opcoes.servidor(request) : Response.json({ error: 'erro_interno' }, { status: 500 });
      },
    }),
  };
  return { auth, chamadas };
}

const syncVazio = (profile: unknown) => ({
  user: { id: PESSOA.id, name: PESSOA.nome, email: PESSOA.email, image: null },
  metadata: { ...DEFAULT_USER_METADATA, profile },
  blocks: [], habits: [], habitLogs: [], sessions: [], restDays: [], proposals: [], mascot: null, serverTime: 1,
});

const PERFIL = { frogName: 'Pulinho', dayStartMinutes: 420, dayEndMinutes: 1320, createdAt: 1 };

const abertos: { unmount(): void }[] = [];
afterEach(async () => {
  // Desmontar limpa os timers do provider (aviso e evento).
  await act(async () => {
    for (const root of abertos.splice(0)) root.unmount();
  });
});

async function montar(props: Parameters<typeof AppProvider>[0] extends infer P ? Omit<NonNullable<P>, 'children'> : never) {
  const atual: { app: AppValue | null } = { app: null };
  function Sonda() {
    atual.app = useApp();
    return null;
  }
  const root = createRoot();
  abertos.push(root);
  await act(async () => {
    root.render(
      <TemaProvider carregarFontes={false}>
        <AppProvider {...props}>
          <Sonda />
        </AppProvider>
      </TemaProvider>,
    );
  });
  const app = () => {
    if (!atual.app) throw new Error('sem contexto');
    return atual.app;
  };
  return { app, root };
}

describe('AppProvider: de onde vêm os dados', () => {
  test('sem sessão e sem demo: tela de login, e o repositório fechado recusa gravar', async () => {
    const { auth } = autenticacaoFalsa({ sessao: async () => null });
    const { app } = await montar({ autenticacao: auth, demoNaAbertura: false });
    expect(app().fase).toBe('login');
    expect(app().user).toBeNull();
    await expect(app().repo.saveBlock({ id: 'x', weekday: 0, startMinutes: 0, durationMinutes: 5, kind: 'foco' })).rejects.toBeInstanceOf(RemoteError);
  });

  test('demo abre sem login e sem tocar a autenticação nem o servidor', async () => {
    const { auth, chamadas } = autenticacaoFalsa({ sessao: async () => PESSOA });
    const { app } = await montar({ autenticacao: auth, demoNaAbertura: true });
    expect(app().fase).toBe('pronto');
    expect(app().demo).toBe(true);
    expect(app().user).not.toBeNull();
    expect((await app().repo.listBlocks()).length).toBeGreaterThan(0);
    expect(chamadas.sessao).toBe(0);
    expect(chamadas.rede).toEqual([]);
  });

  test('demo funciona até sem login configurado', async () => {
    const { app } = await montar({ autenticacao: null, demoNaAbertura: true });
    expect(app().fase).toBe('pronto');
    expect(app().loginDisponivel).toBe(false);
  });

  test('com sessão: faz um GET /api/sync e usa o servidor (User dos metadados)', async () => {
    const { auth, chamadas } = autenticacaoFalsa({ sessao: async () => PESSOA, servidor: () => Response.json(syncVazio(PERFIL)) });
    const { app } = await montar({ autenticacao: auth, demoNaAbertura: false });
    expect(app().fase).toBe('pronto');
    expect(app().demo).toBe(false);
    expect(app().pessoa).toEqual(PESSOA);
    expect(app().user).toMatchObject({ id: PESSOA.id, frogName: 'Pulinho' });
    expect(chamadas.rede).toEqual(['GET /api/sync']);
  });

  test('a proposta da semana vem do servidor com sessão e do app no demo (a fonte segue a origem)', async () => {
    const { auth, chamadas } = autenticacaoFalsa({
      sessao: async () => PESSOA,
      servidor: (request) =>
        new URL(request.url).pathname === '/api/proposals/generate' ? Response.json({ outcome: 'conhecendo' }) : Response.json(syncVazio(PERFIL)),
    });
    const conta = await montar({ autenticacao: auth, demoNaAbertura: false });
    const dadosDaConta = await carregarSemana(conta.app().repo, conta.app().clock, conta.app().user!);
    let saida: ProposalOutcome | undefined;
    await act(async () => {
      saida = await conta.app().propostas.gerar(dadosDaConta);
    });
    expect(saida).toEqual({ kind: 'conhecendo' });
    expect(chamadas.rede).toEqual(['GET /api/sync', 'POST /api/proposals/generate']);

    const demo = autenticacaoFalsa({ sessao: async () => PESSOA });
    const d = await montar({ autenticacao: demo.auth, demoNaAbertura: true });
    const dadosDoDemo = await carregarSemana(d.app().repo, d.app().clock, d.app().user!);
    await act(async () => {
      saida = await d.app().propostas.gerar(dadosDoDemo);
    });
    expect(saida).toMatchObject({ kind: 'proposta', proposal: { origin: 'regra' } });
    expect(demo.chamadas.rede).toEqual([]);
  });

  test('com sessão mas sem perfil: pronto sem User, o que leva ao onboarding', async () => {
    const { auth } = autenticacaoFalsa({ sessao: async () => PESSOA, servidor: () => Response.json(syncVazio(null)) });
    const { app } = await montar({ autenticacao: auth, demoNaAbertura: false });
    expect(app().fase).toBe('pronto');
    expect(app().user).toBeNull();
  });

  test('servidor fora do ar: sem_conexao, e tentar de novo reabre', async () => {
    let no_ar = false;
    const { auth } = autenticacaoFalsa({
      sessao: async () => PESSOA,
      servidor: () => {
        if (!no_ar) throw new TypeError('Network request failed');
        return Response.json(syncVazio(PERFIL));
      },
    });
    const { app } = await montar({ autenticacao: auth, demoNaAbertura: false });
    expect(app().fase).toBe('sem_conexao');
    no_ar = true;
    await act(async () => {
      await app().tentarDeNovo();
    });
    expect(app().fase).toBe('pronto');
  });

  test('401 do servidor volta ao login', async () => {
    const { auth } = autenticacaoFalsa({
      sessao: async () => PESSOA,
      servidor: () => Response.json({ error: 'nao_autenticado' }, { status: 401 }),
    });
    const { app } = await montar({ autenticacao: auth, demoNaAbertura: false });
    expect(app().fase).toBe('login');
  });

  test('sair volta ao login e descarta os dados', async () => {
    const { auth, chamadas } = autenticacaoFalsa({ sessao: async () => PESSOA, servidor: () => Response.json(syncVazio(PERFIL)) });
    const { app } = await montar({ autenticacao: auth, demoNaAbertura: false });
    await act(async () => {
      await app().sair();
    });
    expect(chamadas.sair).toBe(1);
    expect(app().fase).toBe('login');
    expect(app().user).toBeNull();
    expect(app().pessoa).toBeNull();
  });

  test('desligar o demo sem sessão cai no login', async () => {
    const { auth } = autenticacaoFalsa({ sessao: async () => null });
    const { app } = await montar({ autenticacao: auth, demoNaAbertura: true });
    await act(async () => {
      await app().disableDemo();
    });
    expect(app().fase).toBe('login');
  });

  test('escrita que o servidor recusa mostra o aviso em português e repassa o erro', async () => {
    const { auth } = autenticacaoFalsa({
      sessao: async () => PESSOA,
      servidor: (request) =>
        request.method === 'GET' ? Response.json(syncVazio(PERFIL)) : Response.json({ error: 'corpo_invalido' }, { status: 400 }),
    });
    const { app } = await montar({ autenticacao: auth, demoNaAbertura: false });
    let erro: unknown;
    await act(async () => {
      erro = await app().repo.saveBlock({ id: 'b1', weekday: 0, startMinutes: 0, durationMinutes: 5, kind: 'foco' }).catch((e: unknown) => e);
    });
    expect(erro).toBeInstanceOf(RemoteError);
    expect(app().aviso?.mensagem).toMatch(/Confira os campos/);
    expect(await app().repo.listBlocks()).toEqual([]);
  });
});
