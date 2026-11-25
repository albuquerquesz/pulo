import { FOCUS, GOALS, HABITS, JOIAS } from '@pulo/core/config/decisions';
import { verCasa } from '@pulo/core/domain/casa';
import { MINUTE_MS } from '@pulo/core/domain/clock';
import { dateKeyOf } from '@pulo/core/domain/day';
import { elapsedFocusMs } from '@pulo/core/domain/foco';
import { habitsForDate } from '@pulo/core/domain/habits';
import { verSequencia } from '@pulo/core/domain/streak';
import type { Clock, FocusSession, Goal, Habit, Repository, RoomDecor, RoutineBlock, Task, User } from '@pulo/core/domain/types';

import type { ExtrasDoFoco } from '../foco/logic';
import type { VinculoDaCasa } from '../foco/vinculo';

import { verPreferencias } from '../app/conta';

/** O controle dos minutos anda de 5 em 5, entre os limites de `FOCUS`. */
export const PASSO_DOS_MINUTOS = 5;

/** Dentro dos limites e no passo do controle. */
export function ajustarMinutos(minutos: number): number {
  const noPasso = Math.round(minutos / PASSO_DOS_MINUTOS) * PASSO_DOS_MINUTOS;
  return Math.min(FOCUS.maxMinutes, Math.max(FOCUS.minMinutes, noPasso));
}

/** Quanto do controle deslizante está preenchido, em %. */
export const preenchimento = (minutos: number): number => ((minutos - FOCUS.minMinutes) / (FOCUS.maxMinutes - FOCUS.minMinutes)) * 100;

/** Joias que o foco em andamento já rendeu. Só para a tela: o saldo de verdade é calculado quando a sessão acaba. */
export function joiasEstimadas(session: FocusSession, agora: number): number {
  return Math.floor(elapsedFocusMs(session, agora) / (JOIAS.focusMinutesPerJoia * MINUTE_MS));
}

export interface OpcaoDeVinculo {
  chave: string;
  icone: string | null;
  titulo: string;
  extras: ExtrasDoFoco;
}

export const OPCAO_LIVRE: OpcaoDeVinculo = { chave: 'livre', icone: null, titulo: 'Livre', extras: {} };

const ICONE_DA_TAREFA = '📋';
/** Quantos de cada tipo aparecem como opção, para caber numa linha ou duas. */
const OPCOES = { habitos: 2, metas: 1, tarefas: 1 } as const;

interface Alvos {
  habitos: readonly Habit[];
  /** Os hábitos do dia ainda não feitos. */
  pendentes: readonly Habit[];
  metas: readonly Goal[];
  tarefas: readonly Task[];
}

const doHabito = (h: Habit): OpcaoDeVinculo => ({ chave: `habito:${h.id}`, icone: h.icon ?? HABITS.defaultIcon, titulo: h.title, extras: { habitId: h.id } });
const daMeta = (m: Goal): OpcaoDeVinculo => ({ chave: `meta:${m.id}`, icone: m.icon ?? GOALS.defaultIcon, titulo: m.title, extras: { goalId: m.id } });
const daTarefa = (t: Task): OpcaoDeVinculo => ({ chave: `tarefa:${t.id}`, icone: ICONE_DA_TAREFA, titulo: t.title, extras: { taskId: t.id } });

/** As escolhas do "Para:": a que veio pela URL primeiro (já marcada), as sugestões e por fim "Livre". */
export function opcoesDeVinculo(busca: VinculoDaCasa, { habitos, pendentes, metas, tarefas }: Alvos): OpcaoDeVinculo[] {
  const habito = habitos.find((h) => h.id === busca.habito);
  const meta = metas.find((m) => m.id === busca.meta);
  const tarefa = tarefas.find((t) => t.id === busca.tarefa);
  const pedida = habito ? doHabito(habito) : meta ? daMeta(meta) : tarefa ? daTarefa(tarefa) : null;
  const emAberto = [...tarefas.filter((t) => t.status === 'fazendo'), ...tarefas.filter((t) => t.status === 'afazer')];
  const sugestoes = [
    ...pendentes.slice(0, OPCOES.habitos).map(doHabito),
    ...metas.filter((m) => m.state === 'ativa').slice(0, OPCOES.metas).map(daMeta),
    ...emAberto.slice(0, OPCOES.tarefas).map(daTarefa),
  ];
  const outras = sugestoes.filter((o) => o.chave !== pedida?.chave);
  return [...(pedida ? [pedida] : []), ...outras, OPCAO_LIVRE];
}

export interface DadosDaCasa {
  saldo: number;
  diasSeguidos: number;
  quarto: RoomDecor[];
  opcoes: OpcaoDeVinculo[];
  /** O bloco da rotina que veio pela URL, se ainda existe. */
  bloco: RoutineBlock | null;
  /** A duração de foco das preferências, para quando não há bloco. */
  minutosPreferidos: number;
}

export async function carregarCasa(repo: Repository, clock: Clock, user: User, busca: VinculoDaCasa): Promise<DadosDaCasa> {
  const hoje = dateKeyOf(clock.now(), user.timezone);
  const [casa, sequencia, quarto, blocos, habitos, registros, metas, tarefas, preferencias] = await Promise.all([
    verCasa(repo),
    verSequencia(repo, clock),
    repo.listRoomDecor(),
    repo.listBlocks(),
    repo.listHabits(),
    repo.listHabitLogs({ from: hoje, to: hoje }),
    repo.listGoals(),
    repo.listTasks(),
    verPreferencias(repo),
  ]);
  const feitos = new Set(registros.map((r) => r.habitId));
  const pendentes = habitsForDate(habitos, hoje).filter((h) => !feitos.has(h.id));
  return {
    saldo: casa.saldo,
    diasSeguidos: sequencia.atual,
    quarto,
    opcoes: opcoesDeVinculo(busca, { habitos, pendentes, metas, tarefas }),
    bloco: blocos.find((b) => b.id === busca.bloco) ?? null,
    minutosPreferidos: preferencias.focusMinutes,
  };
}
