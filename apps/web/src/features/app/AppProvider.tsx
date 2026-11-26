import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { FROG_EVENT_MS } from '@pulo/core/config/decisions';
import { createRemoteRepository, isRemoteError } from '@pulo/client';
import { systemClock } from '@pulo/core/domain/clock';
import type { WeeklyAiClient } from '@pulo/core/domain/ia';
import type { Clock, FrogEvent, Repository, User } from '@pulo/core/domain/types';
import { eventoAtivo } from '@/mascot';

import type { Autenticacao, MudancaDeConta, PessoaLogada } from '../sessao/auth';
import { ambienteDoApp, endpointDaIa } from '../sessao/config';
import { apagarTodosOsDados, concluirOnboarding, criarClienteDeIa, salvarPerfil, type DadosDoOnboarding } from './core';
import { temConta } from './conta';
import { criarFonteLocal, criarFonteRemota, type PropostaFonte } from '../semana/fonte';
import { comAvisosDeErro, repositorioFechado } from './repositorio';

export interface Aviso {
  id: number;
  mensagem: string;
  variante?: 'sucesso' | 'atencao';
  acao?: string;
  onAcao?: () => void;
}

export interface AppValue {
  repo: Repository;
  clock: Clock;
  user: User | null;
  /** Lendo o repositório pela primeira vez. */
  carregando: boolean;
  /** Muda a cada `refresh()`: telas recarregam quando muda. */
  versao: number;
  refresh(): void;
  aiClient: WeeklyAiClient | null;
  /** De onde vem a proposta da semana e quem aplica a decisão: o servidor (conta) ou o app (repositório em memória dos testes). Escolhida junto com o repositório. */
  propostas: PropostaFonte;

  /**
   * Em que pé está a abertura: `carregando`, `login` (sem sessão), `sem_conexao` (tem sessão mas o servidor
   * não respondeu) ou `pronto` (só aí `repo` tem dados).
   */
  fase: FaseDoApp;
  /** Pessoa logada. */
  pessoa: PessoaLogada | null;
  /** Grava nome e foto. Lança com texto em português se o servidor recusar. */
  editarConta(mudanca: MudancaDeConta): Promise<void>;
  /** Exclui a conta de vez e volta à entrada. A tela pede a confirmação antes. */
  excluirConta(): Promise<void>;
  /** O login está configurado (há endereço da API). Sem ele não dá para entrar. */
  loginDisponivel: boolean;
  entrando: boolean;
  erroDeLogin: string | null;
  entrar(): Promise<void>;
  sair(): Promise<void>;
  /** Tenta abrir de novo (depois de `sem_conexao`). */
  tentarDeNovo(): Promise<void>;

  concluirOnboarding(dados: DadosDoOnboarding): Promise<void>;
  atualizarPerfil(patch: Parameters<typeof salvarPerfil>[2]): Promise<void>;
  apagarDados(): Promise<void>;

  /** Evento transitório do sapo, ainda dentro da janela. */
  evento: FrogEvent | null;
  emitirEvento(tipo: FrogEvent): void;

  aviso: Aviso | null;
  mostrarAviso(a: Omit<Aviso, 'id'>, ms?: number): void;
  esconderAviso(): void;
}

export type FaseDoApp = 'carregando' | 'login' | 'sem_conexao' | 'pronto';

const AppContext = createContext<AppValue | null>(null);

const PRIORIDADE: FrogEvent[] = ['pouso', 'surpreso', 'comemorando', 'construindo', 'feliz'];

export interface AppProviderProps {
  children: ReactNode;
  /** Para testes: usa este repositório como se viesse do servidor, sem passar pelo login. */
  repoInicial?: Repository;
  relogioInicial?: Clock;
  /** Login (veja `autenticacaoDoApp`). `null` ou ausente = login não configurado. */
  autenticacao?: Autenticacao | null;
}

interface Ativo {
  repo: Repository;
  clock: Clock;
  propostas: PropostaFonte;
}

const SEM_DADOS: Ativo = {
  repo: repositorioFechado,
  clock: systemClock,
  propostas: criarFonteLocal(repositorioFechado, systemClock, null),
};

export function AppProvider({ children, repoInicial, relogioInicial, autenticacao = null }: AppProviderProps) {
  const relogioReal = relogioInicial ?? systemClock;
  const auth = autenticacao;
  const [ativo, setAtivo] = useState<Ativo>(SEM_DADOS);
  const [fase, setFase] = useState<FaseDoApp>('carregando');
  const [pessoa, setPessoa] = useState<PessoaLogada | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [erroDeLogin, setErroDeLogin] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const carregando = fase === 'carregando';
  const [versao, setVersao] = useState(0);
  const refresh = useCallback(() => setVersao((v) => v + 1), []);
  const aiClient = useMemo(() => criarClienteDeIa(endpointDaIa(ambienteDoApp(), import.meta.env.DEV)), []);

  // Eventos do sapo
  const [evento, setEvento] = useState<FrogEvent | null>(null);
  const eventoRef = useRef<{ tipo: FrogEvent; desde: number } | null>(null);
  const timerEvento = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const emitirEvento = useCallback((tipo: FrogEvent) => {
    const agora = systemClock.now();
    const atual = eventoAtivo(eventoRef.current, agora, FROG_EVENT_MS);
    if (atual && PRIORIDADE.indexOf(atual) < PRIORIDADE.indexOf(tipo)) return;
    eventoRef.current = { tipo, desde: agora };
    setEvento(tipo);
    clearTimeout(timerEvento.current);
    timerEvento.current = setTimeout(() => {
      setEvento(eventoAtivo(eventoRef.current, systemClock.now(), FROG_EVENT_MS));
    }, FROG_EVENT_MS[tipo] + 20);
  }, []);

  // Aviso (toast)
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const timerAviso = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const contadorAviso = useRef(0);
  const esconderAviso = useCallback(() => {
    clearTimeout(timerAviso.current);
    setAviso(null);
  }, []);
  const mostrarAviso = useCallback((a: Omit<Aviso, 'id'>, ms = 4000) => {
    contadorAviso.current += 1;
    setAviso({ ...a, id: contadorAviso.current });
    clearTimeout(timerAviso.current);
    timerAviso.current = setTimeout(() => setAviso(null), ms);
  }, []);

  // `abrir` é criado antes do aviso na ordem de leitura, mas só o chama depois: a ref evita depender dele.
  const mostrarAvisoRef = useRef(mostrarAviso);
  useLayoutEffect(() => {
    mostrarAvisoRef.current = mostrarAviso;
  });

  useEffect(
    () => () => {
      clearTimeout(timerEvento.current);
      clearTimeout(timerAviso.current);
    },
    [],
  );

  /**
   * ÚNICO lugar que escolhe de onde vêm os dados: com sessão, o RemoteRepository; sem sessão, a tela de login.
   */
  const abrir = useCallback(async () => {
    try {
      if (repoInicial) {
        setPessoa(auth ? await auth.sessaoAtual() : null);
        setAtivo({ repo: repoInicial, clock: relogioReal, propostas: criarFonteLocal(repoInicial, relogioReal, aiClient) });
        setUser(await repoInicial.getUser());
        setFase('pronto');
        return;
      }
      const quem = auth ? await auth.sessaoAtual() : null;
      setPessoa(quem);
      if (auth && quem) {
        const remoto = await createRemoteRepository({ ...auth.rede(), clock: systemClock });
        const sessaoExpirou = () => {
          setPessoa(null);
          setUser(null);
          setAtivo(SEM_DADOS);
          setFase('login');
        };
        const repo = comAvisosDeErro(remoto, {
          avisar: (mensagem) => mostrarAvisoRef.current({ mensagem, variante: 'atencao' }),
          sessaoExpirou,
        });
        const propostas = criarFonteRemota(remoto, { sessaoExpirou });
        setAtivo({ repo, clock: systemClock, propostas });
        setUser(await repo.getUser());
        setFase('pronto');
      } else {
        setAtivo(SEM_DADOS);
        setUser(null);
        setFase('login');
      }
    } catch (erro) {
      setAtivo(SEM_DADOS);
      setUser(null);
      // Sessão que o servidor recusou volta ao login; falta de rede mostra "sem sinal" com nova tentativa.
      setFase(isRemoteError(erro) && erro.kind === 'sessao' ? 'login' : 'sem_conexao');
    } finally {
      setVersao((v) => v + 1);
    }
  }, [auth, repoInicial, relogioReal, aiClient]);

  const tentarDeNovo = useCallback(async () => {
    setFase('carregando');
    await abrir();
  }, [abrir]);

  const entrar = useCallback(async () => {
    if (!auth) {
      setErroDeLogin('O login ainda não está configurado neste app.');
      return;
    }
    setEntrando(true);
    setErroDeLogin(null);
    try {
      await auth.entrarComGoogle();
      setFase('carregando');
      await abrir();
    } catch (erro) {
      setErroDeLogin(erro instanceof Error ? erro.message : 'Não consegui entrar. Tente de novo.');
    } finally {
      setEntrando(false);
    }
  }, [auth, abrir]);

  const sair = useCallback(async () => {
    try {
      await auth?.sair();
    } catch {
      // Sem rede, o cookie local é descartado do mesmo jeito na próxima abertura vencida; a tela volta ao login.
    }
    setPessoa(null);
    setUser(null);
    setAtivo(SEM_DADOS);
    setFase('login');
    setVersao((v) => v + 1);
  }, [auth]);

  const editarConta = useCallback(
    async (mudanca: MudancaDeConta) => {
      await auth?.atualizarConta(mudanca);
      setPessoa((atual) => (atual ? { ...atual, ...mudanca } : atual));
    },
    [auth],
  );

  const excluirConta = useCallback(async () => {
    if (!temConta(ativo.repo)) return;
    await ativo.repo.deleteAccount();
    // O servidor já apagou o cookie: não há sessão para encerrar.
    setPessoa(null);
    setUser(null);
    setAtivo(SEM_DADOS);
    setFase('login');
    setVersao((v) => v + 1);
  }, [ativo]);

  // Abertura
  useEffect(() => {
    (async () => {
      await abrir();
    })();
    // Só na primeira vez: depois, cada ação chama `abrir` por conta própria.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onboarding = useCallback(
    async (dados: DadosDoOnboarding) => {
      const u = await concluirOnboarding(ativo.repo, ativo.clock, dados);
      setUser(u);
      setVersao((v) => v + 1);
    },
    [ativo],
  );

  const atualizarPerfil = useCallback(
    async (patch: Parameters<typeof salvarPerfil>[2]) => {
      if (!user) return;
      try {
        setUser(await salvarPerfil(ativo.repo, user, patch));
        setVersao((v) => v + 1);
      } catch {
        // O repositório remoto já avisou o que houve e voltou ao que era.
      }
    },
    [ativo, user],
  );

  const apagarDados = useCallback(async () => {
    try {
      await apagarTodosOsDados(ativo.repo);
      setUser(await ativo.repo.getUser());
      setVersao((v) => v + 1);
    } catch {
      // Aviso já mostrado; nada foi apagado do ponto de vista da tela.
    }
  }, [ativo]);

  const valor = useMemo<AppValue>(
    () => ({
      repo: ativo.repo,
      clock: ativo.clock,
      user,
      carregando,
      versao,
      refresh,
      aiClient,
      propostas: ativo.propostas,
      fase,
      pessoa,
      editarConta,
      excluirConta,
      loginDisponivel: auth !== null,
      entrando,
      erroDeLogin,
      entrar,
      sair,
      tentarDeNovo,
      concluirOnboarding: onboarding,
      atualizarPerfil,
      apagarDados,
      evento,
      emitirEvento,
      aviso,
      mostrarAviso,
      esconderAviso,
    }),
    [ativo, user, carregando, versao, refresh, aiClient, fase, pessoa, editarConta, excluirConta, auth, entrando, erroDeLogin, entrar, sair, tentarDeNovo, onboarding, atualizarPerfil, apagarDados, evento, emitirEvento, aviso, mostrarAviso, esconderAviso],
  );

  return <AppContext.Provider value={valor}>{children}</AppContext.Provider>;
}

export function useApp(): AppValue {
  const v = useContext(AppContext);
  if (!v) throw new Error('useApp precisa estar dentro de AppProvider.');
  return v;
}
