import { DEFAULT_DAY_END_HOUR, DEFAULT_DAY_START_HOUR, DEFAULT_TIMEZONE } from '@pulo/core/config/decisions';
import { dateKeyOf, localMinutesOf } from '@pulo/core/domain/day';
import { newId } from '@pulo/core/domain/ids';
import { refreshMascotState } from '@pulo/core/domain/phase';
import { criarPlanoInicial } from '@pulo/core/domain/routine';
import { createHttpWeeklyAiClient, type WeeklyAiClient } from '@pulo/core/domain/ia';
import type { Clock, Repository, User } from '@pulo/core/domain/types';
import type { AgoraDaLagoa } from '@pulo/core/domain/lagoa';

export const NOME_PADRAO_DO_SAPO = 'Pulo';

export interface DadosDoOnboarding {
  frogName: string;
  /** Horas cheias, 0 a 23. */
  startHour: number;
  endHour: number;
}

export const ONBOARDING_PADRAO: DadosDoOnboarding = {
  frogName: '',
  startHour: DEFAULT_DAY_START_HOUR,
  endHour: DEFAULT_DAY_END_HOUR,
};

/** Primeira rota: onboarding sem User, Hoje com User. */
export async function rotaInicial(repo: Repository): Promise<'/onboarding' | '/'> {
  return (await repo.getUser()) ? '/' : '/onboarding';
}

/** Mantém o início antes do fim, em horas cheias. */
export function normalizarHorarios(startHour: number, endHour: number): { startHour: number; endHour: number } {
  const s = Math.min(22, Math.max(0, Math.round(startHour)));
  const e = Math.min(24, Math.max(s + 1, Math.round(endHour)));
  return { startHour: s, endHour: e };
}

/** Cria o User, o plano de exemplo e o estado do sapo. Vai para Hoje depois. */
export async function concluirOnboarding(repo: Repository, clock: Clock, dados: DadosDoOnboarding): Promise<User> {
  const now = clock.now();
  const { startHour, endHour } = normalizarHorarios(dados.startHour, dados.endHour);
  const user: User = {
    id: newId(now, 'user'),
    frogName: dados.frogName.trim() || NOME_PADRAO_DO_SAPO,
    timezone: DEFAULT_TIMEZONE,
    dayStartMinutes: startHour * 60,
    dayEndMinutes: endHour * 60,
    theme: 'sistema',
    reduceMotion: false,
    createdAt: now,
  };
  await criarPlanoInicial(repo, now);
  await refreshMascotState(repo, user.timezone, now);
  // O perfil vai por último: é ele que marca o onboarding como feito. Se algo antes falhar, dá para tentar de novo.
  await repo.saveUser(user);
  // O repositório manda: no servidor o id é o da conta e o horário de criação é o guardado.
  return (await repo.getUser()) ?? user;
}

/** "Apagar todos os meus dados": única ação que zera o progresso. */
export async function apagarTodosOsDados(repo: Repository): Promise<void> {
  await repo.clearAll();
}

export function dentroDoDiaDoUsuario(user: User, now: number): boolean {
  const m = localMinutesOf(now, user.timezone);
  return m >= user.dayStartMinutes && m < user.dayEndMinutes;
}

export function hojeDe(user: User, now: number): string {
  return dateKeyOf(now, user.timezone);
}

export function agoraDaLagoa(user: User, now: number, diasDeCuidadoTotal: number, descansoHoje: boolean): AgoraDaLagoa {
  return { diasDeCuidadoTotal, dentroDoDia: dentroDoDiaDoUsuario(user, now), descansoHoje };
}

export async function salvarPerfil(repo: Repository, user: User, patch: Partial<Pick<User, 'dayStartMinutes' | 'dayEndMinutes' | 'theme' | 'reduceMotion' | 'frogName'>>): Promise<User> {
  const next: User = { ...user, ...patch };
  if (next.dayEndMinutes <= next.dayStartMinutes) next.dayEndMinutes = Math.min(24 * 60, next.dayStartMinutes + 60);
  await repo.saveUser(next);
  return next;
}

/** Sem endpoint, não há cliente: as propostas vêm da regra e se chamam "Sugestão". */
export function criarClienteDeIa(endpoint: string | undefined): WeeklyAiClient | null {
  return endpoint ? createHttpWeeklyAiClient({ endpoint }) : null;
}

