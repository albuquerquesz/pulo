import {
  carregarSessaoAtiva,
  concluirFoco,
  interromperFoco,
  iniciarFoco,
  pausarFoco,
  retomarFoco,
  type FocoOutcome,
  reconcileSession,
} from '@pulo/core/domain/foco';
import type { Clock, FocusSession, Repository, User } from '@pulo/core/domain/types';
import { FOCUS, RECARGA } from '@pulo/core/config/decisions';
import { isRemoteError } from '@pulo/client';

import { temRecarga } from '../app/conta';

export type FaseDoFoco = 'ocioso' | 'ativa' | 'concluida' | 'interrompida';

export interface EstadoDoFoco {
  fase: FaseDoFoco;
  sessao: FocusSession | null;
  /** Terminou enquanto o app estava fechado ou em segundo plano. */
  concluiuFora: boolean;
  /** Eventos para o sapo e o aviso. */
  feliz: boolean;
  marco: boolean;
}

export const FOCO_OCIOSO: EstadoDoFoco = {
  fase: 'ocioso',
  sessao: null,
  concluiuFora: false,
  feliz: false,
  marco: false,
};

export const TEXTO_CONCLUIU_FORA = 'Você concluiu enquanto estava fora';
export const TEXTO_PARAR = 'Parar por agora?';
export const TEXTO_PARAR_DETALHE = 'Tudo bem parar. O que você já fez conta, sem culpa.';

function doResultado(o: FocoOutcome, fora: boolean): EstadoDoFoco {
  if (!o.ended) {
    return { ...FOCO_OCIOSO, fase: 'ativa', sessao: o.session };
  }
  const concluida = o.session.state === 'concluida';
  return {
    fase: concluida ? 'concluida' : 'interrompida',
    sessao: o.session,
    concluiuFora: fora && o.concludedWhileAway,
    feliz: o.events.includes('bloco_concluido'),
    marco: o.events.includes('marco'),
  };
}

/** Ao abrir a aba: sessão em andamento aparece direto; se acabou fora, avisa. */
export async function abrirFoco(repo: Repository, clock: Clock, user: User): Promise<EstadoDoFoco> {
  const o = await carregarSessaoAtiva(repo, clock, user.timezone);
  if (!o) return FOCO_OCIOSO;
  return doResultado(o, true);
}

async function rodar(
  repo: Repository,
  clock: Clock,
  user: User,
  fn: () => ReturnType<typeof pausarFoco>,
  fora = false,
): Promise<EstadoDoFoco> {
  const r = await fn();
  if (!r.ok) return abrirFoco(repo, clock, user);
  return doResultado(r.value, fora);
}

/** O bloco da rotina e o alvo (no máximo um) com que o foco começa (spec 19). */
export type ExtrasDoFoco = Pick<FocusSession, 'blockId' | 'habitId' | 'goalId' | 'taskId'>;

export const iniciar = (repo: Repository, clock: Clock, user: User, minutos: number = FOCUS.defaultMinutes, extras: ExtrasDoFoco = {}) =>
  rodar(repo, clock, user, () => iniciarFoco(repo, clock, user.timezone, { plannedMinutes: minutos, ...extras }));
export const pausar = (repo: Repository, clock: Clock, user: User) => rodar(repo, clock, user, () => pausarFoco(repo, clock, user.timezone));
export const retomar = (repo: Repository, clock: Clock, user: User) => rodar(repo, clock, user, () => retomarFoco(repo, clock, user.timezone));
export const parar = (repo: Repository, clock: Clock, user: User) => rodar(repo, clock, user, () => interromperFoco(repo, clock, user.timezone));
/** O relógio confirmou que o tempo acabou com a tela aberta. */
export const concluir = (repo: Repository, clock: Clock, user: User) => rodar(repo, clock, user, () => concluirFoco(repo, clock, user.timezone));

/** Fecha, no fim planejado, o foco em andamento cujo tempo já acabou. `null` se não havia o que fechar. */
export async function encerrarFocoVencido(repo: Repository, clock: Clock, user: User): Promise<EstadoDoFoco | null> {
  const ativa = (await repo.listSessions()).find((s) => s.state === 'em_andamento');
  if (!ativa || reconcileSession(ativa, clock.now()) === ativa) return null;
  return abrirFoco(repo, clock, user);
}

/** A espera antes da próxima tentativa, que dobra a cada falha seguida. */
export const esperaDeNovaTentativa = (falhas: number): number =>
  Math.min(RECARGA.esperaMaximaMs, RECARGA.esperaInicialMs * 2 ** Math.max(0, falhas - 1));

/** O servidor recusou porque o que ele guarda é outro (ex.: `sessao_encerrada`). */
export const ehConflito = (erro: unknown): boolean => isRemoteError(erro) && erro.kind === 'api' && erro.status === 409;

/** Relê o servidor, quando há um. Lança se não conseguir. */
export async function reler(repo: Repository): Promise<void> {
  if (temRecarga(repo)) await repo.reload();
}
