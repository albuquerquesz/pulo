import { DEFAULT_TIMEZONE, GOALS } from '@pulo/core/config/decisions';
import { verCasa, type ParteId, type ProximaParte } from '@pulo/core/domain/casa';
import { MINUTE_MS } from '@pulo/core/domain/clock';
import { dateKeyOf } from '@pulo/core/domain/day';
import { estadoDoBau, goalProgress, sortGoals } from '@pulo/core/domain/goals';
import { habitsForDate } from '@pulo/core/domain/habits';
import { verGelo } from '@pulo/core/domain/gelo';
import { focusedMs, textoDeFalta } from '@pulo/core/domain/joias';
import { verSequencia } from '@pulo/core/domain/streak';
import type { AccentColor, Clock, DateKey, FocusSession, FreezeSummary, Goal, GoalChest, Habit, HabitLog, Repository, User } from '@pulo/core/domain/types';

export interface ContaNaTela {
  nome: string;
  email: string;
  foto?: string | null;
}

/** Quem a casca e o Hoje mostram: a conta (logada ou do demo) ou, sem conta, o nome do sapo. */
export function contaNaTela(pessoa: ContaNaTela | null, user: User | null): ContaNaTela {
  return pessoa ?? { nome: user?.frogName ?? 'Você', email: '' };
}

export type ChaveDaAba = 'hoje' | 'ilha' | 'tarefas' | 'habitos' | 'metas';

/** O menu, na ordem do rascunho. */
export const ABAS = [
  { chave: 'hoje', rotulo: 'Hoje', para: '/' },
  { chave: 'ilha', rotulo: 'Ilha', para: '/ilha' },
  { chave: 'tarefas', rotulo: 'Tarefas', para: '/tarefas' },
  { chave: 'habitos', rotulo: 'Hábitos', para: '/habitos' },
  { chave: 'metas', rotulo: 'Metas', para: '/metas' },
] as const satisfies readonly { chave: ChaveDaAba; rotulo: string; para: string }[];

/** A aba acesa. A Casa e o Perfil não têm item no menu. */
export function abaAtiva(caminho: string): ChaveDaAba | null {
  return ABAS.find((a) => a.para === caminho)?.chave ?? null;
}

/** Telas de imersão: ocupam também a coluna do trilho. */
const IMERSAO: readonly string[] = ['/ilha', '/casa', '/tarefas'];
export const telaDeImersao = (caminho: string): boolean => IMERSAO.includes(caminho);

export const EMOJI_DA_PARTE: Record<ParteId, string> = {
  quarto: '🛏️',
  cozinha: '🍳',
  varanda: '🪑',
  jardim: '🌷',
  arvore: '🌳',
  cerca: '🪵',
};

export interface FraseDaProximaParte {
  antes: string;
  destaque: string;
  depois: string;
}

/** A frase do cartão da casa: o que falta para a próxima parte, ou que já dá para construir. */
export function fraseDaProximaParte(proxima: ProximaParte | null): FraseDaProximaParte {
  if (!proxima) return { antes: '', destaque: 'Casa completa!', depois: '' };
  const destaque = `${EMOJI_DA_PARTE[proxima.id]} ${proxima.nome}`;
  if (proxima.faltam === 0) return { antes: 'Você já pode construir: ', destaque, depois: '' };
  const falta = textoDeFalta(proxima.faltam).replace(/\.$/, '').toLowerCase();
  return { antes: 'Próxima: ', destaque, depois: ` · ${falta}, uns ${proxima.horasDeFoco}h de foco` };
}

export interface MetaDoTrilho {
  id: string;
  titulo: string;
  icone: string;
  cor: AccentColor;
  feito: number;
  total: number;
  concluida: boolean;
  bauAberto: boolean;
}

/** A meta como o trilho e a página do hábito mostram: ícone, cor, barra e baú. */
export function metaNaTela(meta: Goal, baus: readonly GoalChest[]): MetaDoTrilho {
  const { done, total } = goalProgress(meta);
  const concluida = meta.state === 'concluida';
  return {
    id: meta.id,
    titulo: meta.title,
    icone: meta.icon ?? GOALS.defaultIcon,
    cor: meta.color ?? GOALS.defaultColor,
    // Sem marcos, a meta é um passo só.
    feito: total === 0 ? Number(concluida) : done,
    total: total === 0 ? 1 : total,
    concluida,
    bauAberto: estadoDoBau(meta, baus) === 'aberto',
  };
}

/** Até três metas: as ativas (prazo mais perto antes) e, se sobrar lugar, as concluídas mais recentes. */
export function metasDoTrilho(metas: readonly Goal[], baus: readonly GoalChest[]): MetaDoTrilho[] {
  return sortGoals(metas)
    .slice(0, GOALS.maxActive)
    .map((meta) => metaNaTela(meta, baus));
}

export interface HabitosDoDia {
  feitos: number;
  total: number;
}

export function habitosDoDia(habitos: readonly Habit[], registros: readonly HabitLog[], hoje: DateKey): HabitosDoDia {
  const feitos = new Set(registros.filter((r) => r.date === hoje).map((r) => r.habitId));
  const doDia = habitsForDate(habitos, hoje);
  return { feitos: doDia.filter((h) => feitos.has(h.id)).length, total: doDia.length };
}

/** Minutos inteiros focados nas sessões encerradas no dia (sem as pausas e até o planejado). */
export function minutosDeFocoDoDia(sessoes: readonly FocusSession[], hoje: DateKey, fuso: string): number {
  const ms = sessoes
    .filter((s) => dateKeyOf(s.endedAt ?? s.startedAt, fuso) === hoje)
    .reduce((total, s) => total + focusedMs(s), 0);
  return Math.floor(ms / MINUTE_MS);
}

export interface DadosDoTrilho {
  hoje: DateKey;
  sequencia: number;
  /** `null` onde o repositório não guarda gelo. */
  gelo: FreezeSummary | null;
  habitos: HabitosDoDia;
  minutosDeFoco: number;
  joias: number;
  partesConstruidas: ParteId[];
  totalDePartes: number;
  proximaParte: ProximaParte | null;
  metas: MetaDoTrilho[];
}

export async function carregarTrilho(repo: Repository, clock: Clock, user: User): Promise<DadosDoTrilho> {
  const fuso = user.timezone || DEFAULT_TIMEZONE;
  const hoje = dateKeyOf(clock.now(), fuso);
  const [sequencia, gelo, casa, habitos, registros, sessoes, metas, baus] = await Promise.all([
    verSequencia(repo, clock),
    verGelo(repo, clock),
    verCasa(repo),
    repo.listHabits(),
    repo.listHabitLogs({ from: hoje, to: hoje }),
    repo.listSessions(),
    repo.listGoals(),
    repo.listGoalChests(),
  ]);
  return {
    hoje,
    sequencia: sequencia.atual,
    gelo,
    habitos: habitosDoDia(habitos, registros, hoje),
    minutosDeFoco: minutosDeFocoDoDia(sessoes, hoje, fuso),
    joias: casa.saldo,
    partesConstruidas: casa.partes.filter((p) => p.construida).map((p) => p.id),
    totalDePartes: casa.total,
    proximaParte: casa.proxima,
    metas: metasDoTrilho(metas, baus),
  };
}
