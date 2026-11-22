import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { FROG_EVENT_MS } from '@pulo/core/config/decisions';
import { createDefaultAdapter, createStorageRepository } from '@/data';
import type { DemoClock } from '@pulo/core/demo';
import { systemClock } from '@pulo/core/domain/clock';
import type { WeeklyAiClient } from '@pulo/core/domain/ia';
import type { Clock, FrogEvent, Repository, User } from '@pulo/core/domain/types';
import { eventoAtivo } from '@/mascot';

import { apagarTodosOsDados, concluirOnboarding, criarClienteDeIa, demoPedidoNaUrl, salvarPerfil, type DadosDoOnboarding } from './core';
import { criarSessaoDemo } from './demo';

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

  demo: boolean;
  demoClock: DemoClock | null;
  enableDemo(): Promise<void>;
  disableDemo(): Promise<void>;

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

const AppContext = createContext<AppValue | null>(null);

const PRIORIDADE: FrogEvent[] = ['pouso', 'surpreso', 'feliz'];

export interface AppProviderProps {
  children: ReactNode;
  /** Para testes. */
  repoInicial?: Repository;
  relogioInicial?: Clock;
  /** Padrão: lê `?demo=1` da URL. */
  demoNaAbertura?: boolean;
}

export function AppProvider({ children, repoInicial, relogioInicial, demoNaAbertura }: AppProviderProps) {
  const repoReal = useMemo<Repository>(() => repoInicial ?? createStorageRepository(createDefaultAdapter()), [repoInicial]);
  const relogioReal = relogioInicial ?? systemClock;
  const [ativo, setAtivo] = useState<{ repo: Repository; clock: Clock; demoClock: DemoClock | null }>(() => ({
    repo: repoReal,
    clock: relogioReal,
    demoClock: null,
  }));
  const [user, setUser] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [versao, setVersao] = useState(0);
  const refresh = useCallback(() => setVersao((v) => v + 1), []);
  const aiClient = useMemo(() => criarClienteDeIa(`${import.meta.env.VITE_API_URL}/weekly-ai`), []);

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

  useEffect(
    () => () => {
      clearTimeout(timerEvento.current);
      clearTimeout(timerAviso.current);
    },
    [],
  );

  const carregarUsuario = useCallback(async (repo: Repository) => {
    setUser(await repo.getUser());
  }, []);

  const enableDemo = useCallback(async () => {
    const s = await criarSessaoDemo();
    setAtivo({ repo: s.repo, clock: s.clock, demoClock: s.clock });
    await carregarUsuario(s.repo);
    setVersao((v) => v + 1);
  }, [carregarUsuario]);

  const disableDemo = useCallback(async () => {
    setAtivo({ repo: repoReal, clock: relogioReal, demoClock: null });
    await carregarUsuario(repoReal);
    setVersao((v) => v + 1);
  }, [carregarUsuario, repoReal, relogioReal]);

  // Abertura
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const search = (globalThis as { location?: { search?: string } }).location?.search;
        if (demoNaAbertura ?? demoPedidoNaUrl(search)) {
          await enableDemo();
        } else {
          const u = await repoReal.getUser();
          if (vivo) setUser(u);
        }
      } catch {
        if (vivo) setUser(null);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
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
      setUser(await salvarPerfil(ativo.repo, user, patch));
      setVersao((v) => v + 1);
    },
    [ativo, user],
  );

  const apagarDados = useCallback(async () => {
    // No demo só os dados de exemplo (memória) somem; os dados reais ficam intactos.
    await apagarTodosOsDados(ativo.repo);
    setAtivo({ repo: repoReal, clock: relogioReal, demoClock: null });
    setUser(ativo.demoClock ? await repoReal.getUser() : null);
    setVersao((v) => v + 1);
  }, [ativo, repoReal, relogioReal]);

  const valor = useMemo<AppValue>(
    () => ({
      repo: ativo.repo,
      clock: ativo.clock,
      user,
      carregando,
      versao,
      refresh,
      aiClient,
      demo: ativo.demoClock !== null,
      demoClock: ativo.demoClock,
      enableDemo,
      disableDemo,
      concluirOnboarding: onboarding,
      atualizarPerfil,
      apagarDados,
      evento,
      emitirEvento,
      aviso,
      mostrarAviso,
      esconderAviso,
    }),
    [ativo, user, carregando, versao, refresh, aiClient, enableDemo, disableDemo, onboarding, atualizarPerfil, apagarDados, evento, emitirEvento, aviso, mostrarAviso, esconderAviso],
  );

  return <AppContext.Provider value={valor}>{children}</AppContext.Provider>;
}

export function useApp(): AppValue {
  const v = useContext(AppContext);
  if (!v) throw new Error('useApp precisa estar dentro de AppProvider.');
  return v;
}
