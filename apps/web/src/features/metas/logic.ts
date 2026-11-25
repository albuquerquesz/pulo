import { GOALS } from '@pulo/core/config/decisions';
import { dateKeyOf } from '@pulo/core/domain/day';
import { daysUntilTarget, sortGoals } from '@pulo/core/domain/goals';
import type { Clock, DateKey, Goal, Repository, User } from '@pulo/core/domain/types';

export interface DadosMetas {
  hoje: DateKey;
  ativas: Goal[];
  concluidas: Goal[];
  /** Ainda cabe uma meta ativa nova. */
  cabeMais: boolean;
}

export async function carregarMetas(repo: Repository, clock: Clock, user: User): Promise<DadosMetas> {
  const metas = sortGoals(await repo.listGoals());
  const ativas = metas.filter((m) => m.state === 'ativa');
  return {
    hoje: dateKeyOf(clock.now(), user.timezone),
    ativas,
    concluidas: metas.filter((m) => m.state === 'concluida'),
    cabeMais: ativas.length < GOALS.maxActive,
  };
}

const DATA_LONGA = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const MES_E_ANO = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const comoData = (key: DateKey) => new Date(`${key}T00:00:00Z`);

/** "1 de junho de 2027". */
export function dataPorExtenso(key: DateKey): string {
  return DATA_LONGA.format(comoData(key));
}

/** "junho de 2027". */
export function mesEAno(key: DateKey): string {
  return MES_E_ANO.format(comoData(key));
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);
const falta = (n: number, um: string, varios: string) => `${n === 1 ? 'Falta' : 'Faltam'} ${plural(n, um, varios)}`;

/** Quanto falta, na escala que faz sentido para uma meta longa (dias, meses ou anos). */
export function textoDoPrazo(meta: Goal, hoje: DateKey): string | null {
  const dias = daysUntilTarget(meta, hoje);
  if (dias === null) return null;
  if (dias < 0) return `O prazo passou há ${plural(-dias, 'dia', 'dias')}`;
  if (dias === 0) return 'O prazo é hoje';
  if (dias <= 60) return falta(dias, 'dia', 'dias');
  const meses = Math.round(dias / 30.44);
  if (meses < 24) return falta(meses, 'mês', 'meses');
  return falta(Math.round(dias / 365.25), 'ano', 'anos');
}

/** Linhas do campo de marcos: uma por marco, sem as vazias. */
export function marcosDoTexto(texto: string): string[] {
  return texto
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean);
}

export interface BuscaDeMetas {
  /** A meta que abre junto com a tela (o "Ver meta" do hábito). */
  meta?: string;
}

export function lerBuscaDeMetas(busca: Record<string, unknown>): BuscaDeMetas {
  return typeof busca.meta === 'string' && busca.meta ? { meta: busca.meta } : {};
}
