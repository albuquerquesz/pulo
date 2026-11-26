import { DEFAULT_TIMEZONE } from '@pulo/core/config/decisions';
import { listFreezeDatesOf } from '@pulo/core/domain/gelo-store';
import { streakDaySets } from '@pulo/core/domain/streak';
import type { Clock, DateKey, Repository, User } from '@pulo/core/domain/types';

import { temDatasDoGelo } from '../app/conta';
import { carregarMetricas } from '../casca/metricas';

export interface NumerosDoMes {
  diasDeCuidado: number;
  descansos: number;
  gelosUsados: number;
}

/** Quantas das datas caem no mês de `hoje`, sem repetir e sem contar o futuro. */
export function diasNoMes(datas: Iterable<DateKey>, hoje: DateKey): number {
  const mes = hoje.slice(0, 7);
  return [...new Set(datas)].filter((data) => data.startsWith(mes) && data <= hoje).length;
}

const datasDoGelo = (repo: Repository): Promise<DateKey[]> => (temDatasDoGelo(repo) ? repo.getFreezeDates() : listFreezeDatesOf(repo));

/** Os três números do cartão Seu mês. Dia de cuidado: com hábito feito, foco que conta ou descanso marcado. */
export async function carregarMes(repo: Repository, clock: Clock, user: User, versao: number): Promise<NumerosDoMes> {
  const [habitLogs, sessions, restDays, gelos, metricas] = await Promise.all([
    repo.listHabitLogs(),
    repo.listSessions(),
    repo.listRestDays(),
    datasDoGelo(repo),
    carregarMetricas(repo, clock, versao),
  ]);
  const { today, done, rest } = streakDaySets({
    habitLogs,
    sessions,
    restDays,
    timeZone: user.timezone || DEFAULT_TIMEZONE,
    dayStartMinutes: user.dayStartMinutes,
    now: clock.now(),
  });
  return {
    diasDeCuidado: diasNoMes([...done, ...rest], today),
    descansos: metricas.descanso.noMes,
    gelosUsados: diasNoMes(gelos, today),
  };
}
