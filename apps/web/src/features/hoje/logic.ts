import { FOCUS, GOALS, HABITS } from '@pulo/core/config/decisions';
import { dateKeyOf, localMinutesOf, periodOf, weekdayOf } from '@pulo/core/domain/day';
import { hasTimeRunOut, proximoFoco } from '@pulo/core/domain/foco';
import { desmarcarDescanso, marcarDescanso, situacaoDoDescanso } from '@pulo/core/domain/descanso';
import { desmarcarHabito, habitsForDate, marcarHabito } from '@pulo/core/domain/habits';
import { joiasGanhas } from '@pulo/core/domain/joias';
import { blocksForWeekday } from '@pulo/core/domain/routine';
import { verSequencia } from '@pulo/core/domain/streak';
import { byPosition, moverTarefa } from '@pulo/core/domain/tasks';
import type {
  Clock,
  DateKey,
  FocusSession,
  Goal,
  GoalChest,
  Habit,
  HabitLog,
  Period,
  Repository,
  RestDay,
  RestStatus,
  RoutineBlock,
  StreakDay,
  Task,
  User,
  Weekday,
} from '@pulo/core/domain/types';

import { verPreferencias } from '../app/conta';
import { minutosDeFocoDoDia } from '../casca/logic';
import type { VinculoDaCasa } from '../foco/vinculo';

const MINUTOS_DO_DIA = 24 * 60;

// ---------- Saudação ----------

const SAUDACOES: Record<Period, string> = { manha: 'Bom dia', tarde: 'Boa tarde', noite: 'Boa noite' };

/** "Bom dia, Ana", pela hora local no fuso da pessoa e só com o primeiro nome. */
export function saudacao(agora: number, fuso: string, nome: string): string {
  const [primeiro] = nome.trim().split(/\s+/);
  const texto = SAUDACOES[periodOf(agora, fuso)];
  return primeiro ? `${texto}, ${primeiro}` : texto;
}

// ---------- Textos de horário ----------

/** "08h00", como na Linha do dia. */
export function horaCheia(minutos: number): string {
  const doDia = minutos % MINUTOS_DO_DIA;
  return `${String(Math.floor(doDia / 60)).padStart(2, '0')}h${String(doDia % 60).padStart(2, '0')}`;
}

/** "15 min", "1h" ou "1h30". */
export function duracaoTexto(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const resto = minutos % 60;
  return `${Math.floor(minutos / 60)}h${resto === 0 ? '' : String(resto).padStart(2, '0')}`;
}

/** Tempo livre arredondado para baixo: horas inteiras a partir de uma hora ("livre · 4h"). */
export function textoDeFolga(minutos: number): string {
  return `livre · ${minutos < 60 ? `${minutos} min` : `${Math.floor(minutos / 60)}h`}`;
}

// ---------- Sequência e semana ----------

/** Letra de cada dia da semana (0 = segunda). */
const LETRAS: Record<Weekday, string> = { 0: 'S', 1: 'T', 2: 'Q', 3: 'Q', 4: 'S', 5: 'S', 6: 'D' };

export type TomDoDia = 'feito' | 'descanso' | 'gelo' | 'hoje' | 'apagado';

const NOMES_DOS_DIAS: Record<Weekday, string> = { 0: 'segunda', 1: 'terça', 2: 'quarta', 3: 'quinta', 4: 'sexta', 5: 'sábado', 6: 'domingo' };

const DESCRICAO_DO_TOM: Record<TomDoDia, string> = {
  feito: 'feito',
  descanso: 'descanso',
  gelo: 'protegido por gelo',
  hoje: 'hoje',
  apagado: 'sem registro',
};

export interface LetraDaSemana {
  date: DateKey;
  letra: string;
  tom: TomDoDia;
  /** Para o leitor de tela: "sábado, protegido por gelo". */
  descricao: string;
}

export interface BarraDaSemana {
  letras: LetraDaSemana[];
  /** De 0 a 1: a barra enche até o meio do dia de hoje. */
  cheio: number;
  /** Os 7 dias feitos ou de descanso: o foguinho do fim acende. */
  completa: boolean;
}

/** O último dia que não é futuro é hoje. */
function indiceDeHoje(semana: readonly StreakDay[]): number {
  return semana.reduce((ultimo, dia, i) => (dia.estado === 'futuro' ? ultimo : i), 0);
}

/** O descanso de hoje já aparece com a lua; o resto do dia de hoje segue em aberto. */
function tomDoDia(dia: StreakDay, ehHoje: boolean): TomDoDia {
  if (ehHoje) return dia.estado === 'descanso' ? 'descanso' : 'hoje';
  return dia.estado === 'feito' || dia.estado === 'descanso' || dia.estado === 'gelo' ? dia.estado : 'apagado';
}

/** A semana como fica ao marcar ou desmarcar o descanso de hoje, antes da resposta. Dia feito continua feito. */
export function comDescansoDeHoje(semana: readonly StreakDay[], marcado: boolean): StreakDay[] {
  const hoje = indiceDeHoje(semana);
  return semana.map((dia, i): StreakDay => {
    if (i !== hoje || dia.estado === 'feito') return dia;
    return { ...dia, estado: marcado ? 'descanso' : 'hoje' };
  });
}

const cuidado = (dia: StreakDay): boolean => dia.estado === 'feito' || dia.estado === 'descanso';

export function barraDaSemana(semana: readonly StreakDay[]): BarraDaSemana {
  const hoje = indiceDeHoje(semana);
  return {
    letras: semana.map((dia, i) => {
      const tom = tomDoDia(dia, i === hoje);
      const weekday = weekdayOf(dia.date);
      return { date: dia.date, letra: LETRAS[weekday], tom, descricao: `${NOMES_DOS_DIAS[weekday]}, ${DESCRICAO_DO_TOM[tom]}` };
    }),
    cheio: semana.length === 0 ? 0 : (hoje + 0.5) / semana.length,
    completa: semana.length > 0 && semana.every(cuidado),
  };
}

/** Alturas do gráfico, em % (medidas do rascunho): a maior barra, o descanso sem foco e o dia vazio. */
const ALTURA = { maxima: 90, descanso: 40, minima: 12, vazia: 6 } as const;

export type TipoDaBarra = 'foco' | 'descanso' | 'gelo' | 'vazia';

export interface BarraDoGrafico {
  date: DateKey;
  letra: string;
  minutos: number;
  tipo: TipoDaBarra;
  altura: number;
}

export interface GraficoDaSemana {
  /** Dias da semana feitos ou de descanso. */
  diasDeCuidado: number;
  barras: BarraDoGrafico[];
  minutos: number;
  joias: number;
}

export interface RegistrosDaSemana {
  semana: readonly StreakDay[];
  sessions: readonly FocusSession[];
  restDays: readonly RestDay[];
  habitLogs: readonly HabitLog[];
  goals: readonly Goal[];
  baus: readonly GoalChest[];
  fuso: string;
}

/** Joias ganhas só nos dias dados, pela mesma regra do saldo. */
function joiasDosDias({ sessions, restDays, habitLogs, goals, baus, fuso }: RegistrosDaSemana, dias: ReadonlySet<DateKey>): number {
  const nosDias = (instante: number) => dias.has(dateKeyOf(instante, fuso));
  return joiasGanhas({
    habitLogs: habitLogs.filter((r) => dias.has(r.date)),
    sessions: sessions.filter((s) => nosDias(s.endedAt ?? s.startedAt)),
    restDays: restDays.filter((r) => dias.has(r.date)),
    goals: goals.map((g) => ({ ...g, milestones: g.milestones.filter((m) => m.doneAt !== undefined && nosDias(m.doneAt)) })),
    baus: baus.filter((b) => nosDias(b.abertoEm)),
    credito: 0,
  }).total;
}

/** O gráfico "Esta semana", nos mesmos 7 dias da sequência (domingo a sábado). */
export function graficoDaSemana(registros: RegistrosDaSemana): GraficoDaSemana {
  const { semana, sessions, restDays, fuso } = registros;
  const descansos = new Set(restDays.map((r) => r.date));
  const minutos = semana.map((dia) => minutosDeFocoDoDia(sessions, dia.date, fuso));
  const maior = Math.max(0, ...minutos);
  const barras = semana.map((dia, i): BarraDoGrafico => {
    const doDia = minutos[i] ?? 0;
    const descanso = dia.estado !== 'futuro' && (dia.estado === 'descanso' || descansos.has(dia.date));
    const proporcional = doDia === 0 ? 0 : Math.max(ALTURA.minima, Math.round((doDia / maior) * ALTURA.maxima));
    const tipo: TipoDaBarra = descanso ? 'descanso' : doDia > 0 ? 'foco' : dia.estado === 'gelo' ? 'gelo' : 'vazia';
    const alturas: Record<TipoDaBarra, number> = {
      descanso: Math.max(ALTURA.descanso, proporcional),
      gelo: ALTURA.descanso,
      foco: proporcional,
      vazia: ALTURA.vazia,
    };
    const altura = alturas[tipo];
    return { date: dia.date, letra: LETRAS[weekdayOf(dia.date)], minutos: doDia, tipo, altura };
  });
  return {
    diasDeCuidado: semana.filter(cuidado).length,
    barras,
    minutos: minutos.reduce((total, n) => total + n, 0),
    joias: joiasDosDias(registros, new Set(semana.filter((d) => d.estado !== 'futuro').map((d) => d.date))),
  };
}

// ---------- Hábitos e tarefas ----------

const DIAS_DA_SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'] as const;
const PERIODO_DO_HABITO: Record<Period, string> = { manha: 'manhã', tarde: 'tarde', noite: 'noite' };

/** A legenda do hábito: o período, "todo dia" ou os dias da semana. */
export function quandoDoHabito(habito: Pick<Habit, 'period' | 'weekdays'>): string {
  if (habito.period) return PERIODO_DO_HABITO[habito.period];
  if (habito.weekdays.length === DIAS_DA_SEMANA.length) return 'todo dia';
  return habito.weekdays.map((d) => DIAS_DA_SEMANA[d]).join(', ');
}

export interface HabitoDeHoje {
  id: string;
  titulo: string;
  quando: string;
  feito: boolean;
}

export interface TarefaDeHoje {
  id: string;
  titulo: string;
  feita: boolean;
}

/** Tarefas com prazo hoje, na ordem do quadro, com as feitas por último. */
export function tarefasDeHoje(tarefas: readonly Task[], hoje: DateKey): TarefaDeHoje[] {
  return tarefas
    .filter((t) => t.dueDate === hoje)
    .sort((a, b) => Number(a.status === 'feito') - Number(b.status === 'feito') || byPosition(a, b))
    .map((t) => ({ id: t.id, titulo: t.title, feita: t.status === 'feito' }));
}

// ---------- Próximo foco e vínculo ----------

export interface AlvoNaTela {
  icone: string;
  titulo: string;
}

export interface Alvos {
  habitos: readonly Habit[];
  metas: readonly Goal[];
  tarefas: readonly Task[];
}

/** Ícone de uma tarefa atrelada (o quadro não tem ícone próprio). */
const ICONE_DA_TAREFA = '📋';
const ICONE_DO_BLOCO = { foco: GOALS.defaultIcon, descanso: '🛋️' } as const;
const TITULO_DO_BLOCO = { foco: 'Foco', descanso: 'Descanso' } as const;

export interface VinculoDoBloco {
  busca: VinculoDaCasa;
  alvo: AlvoNaTela | null;
}

/**
 * O bloco da rotina não guarda alvo: vale o da sessão mais recente do bloco que tinha um (a aberta, se houver).
 * Alvo apagado é ignorado.
 */
export function vinculoDoBloco(blockId: string, sessions: readonly FocusSession[], alvos: Alvos): VinculoDoBloco {
  const recentes = sessions.filter((s) => s.blockId === blockId).sort((a, b) => b.startedAt - a.startedAt);
  for (const s of recentes) {
    const habito = alvos.habitos.find((h) => h.id === s.habitId);
    if (habito) {
      return { busca: { bloco: blockId, habito: habito.id }, alvo: { icone: habito.icon ?? HABITS.defaultIcon, titulo: habito.title } };
    }
    const meta = alvos.metas.find((m) => m.id === s.goalId);
    if (meta) return { busca: { bloco: blockId, meta: meta.id }, alvo: { icone: meta.icon ?? GOALS.defaultIcon, titulo: meta.title } };
    const tarefa = alvos.tarefas.find((t) => t.id === s.taskId);
    if (tarefa) return { busca: { bloco: blockId, tarefa: tarefa.id }, alvo: { icone: ICONE_DA_TAREFA, titulo: tarefa.title } };
  }
  return { busca: { bloco: blockId }, alvo: null };
}

export interface FocoDoTopo extends VinculoDoBloco {
  /** `null` quando não resta foco na rotina de hoje. */
  titulo: string | null;
  minutos: number;
}

// ---------- Linha do dia ----------

export type EstadoDoBloco = 'feito' | 'agora' | 'pendente';

export interface BlocoNaLinha {
  tipo: 'bloco';
  id: string;
  icone: string;
  titulo: string;
  inicio: number;
  fim: number;
  faixa: string;
  estado: EstadoDoBloco;
  /** Presente no bloco de foco do horário atual: é o botão Focar. */
  focar: VinculoDaCasa | null;
}

export interface FolgaNaLinha {
  tipo: 'livre';
  id: string;
  texto: string;
}

export type ItemDaLinha = BlocoNaLinha | FolgaNaLinha;

/** Entre quais blocos fica o maior respiro do dia: o índice do bloco de depois, ou `null` sem nenhum. */
function maiorFolga(blocos: readonly RoutineBlock[]): { antesDe: number; minutos: number } | null {
  let maior: { antesDe: number; minutos: number } | null = null;
  for (const [i, bloco] of blocos.entries()) {
    const anterior = blocos[i - 1];
    if (!anterior) continue;
    const minutos = bloco.startMinutes - anterior.startMinutes - anterior.durationMinutes;
    if (minutos > (maior?.minutos ?? 0)) maior = { antesDe: i, minutos };
  }
  return maior;
}

export interface EntradaDaLinha {
  /** Os blocos de hoje, em ordem de horário. */
  blocos: readonly RoutineBlock[];
  sessions: readonly FocusSession[];
  alvos: Alvos;
  descansoHoje: boolean;
  hoje: DateKey;
  /** Minutos de agora desde 00:00 do dia lógico. */
  minutos: number;
  agora: number;
  fuso: string;
}

export function linhaDoDia({ blocos, sessions, alvos, descansoHoje, hoje, minutos, agora, fuso }: EntradaDaLinha): ItemDaLinha[] {
  const concluidos = new Set(
    sessions
      .filter((s) => (s.state === 'concluida' || hasTimeRunOut(s, agora)) && dateKeyOf(s.startedAt, fuso) === hoje)
      .map((s) => s.blockId),
  );
  const folga = maiorFolga(blocos);
  return blocos.flatMap((bloco, i): ItemDaLinha[] => {
    const inicio = bloco.startMinutes;
    const fim = inicio + bloco.durationMinutes;
    const feito = bloco.kind === 'descanso' ? descansoHoje : concluidos.has(bloco.id);
    const estado: EstadoDoBloco = feito ? 'feito' : inicio <= minutos && minutos < fim ? 'agora' : 'pendente';
    const item: BlocoNaLinha = {
      tipo: 'bloco',
      id: bloco.id,
      icone: bloco.icon ?? ICONE_DO_BLOCO[bloco.kind],
      titulo: bloco.title ?? TITULO_DO_BLOCO[bloco.kind],
      inicio,
      fim,
      faixa: `${horaCheia(inicio)} – ${horaCheia(fim)}`,
      estado,
      focar: estado === 'agora' && bloco.kind === 'foco' ? vinculoDoBloco(bloco.id, sessions, alvos).busca : null,
    };
    if (folga?.antesDe !== i) return [item];
    return [{ tipo: 'livre', id: `livre-${bloco.id}`, texto: textoDeFolga(folga.minutos) }, item];
  });
}

export interface MarcoDaLinha {
  inicio: number;
  fim: number;
  /** Altura do centro do círculo do bloco dentro do cartão, em px. */
  centro: number;
}

/** Distância entre o ponto e o círculo do bloco em andamento, para um não cobrir o outro. */
const FOLGA_DO_PONTO = 32;

/** Altura do ponto da hora atual: proporcional ao tempo entre o começo de um bloco e o do seguinte. */
export function posicaoDoAgora(marcos: readonly MarcoDaLinha[], minutos: number): number | null {
  const primeiro = marcos[0];
  if (!primeiro) return null;
  const i = marcos.reduce((ultimo, marco, indice) => (marco.inicio <= minutos ? indice : ultimo), -1);
  const atual = marcos[i];
  if (!atual) return primeiro.centro;
  const seguinte = marcos[i + 1];
  const andando = minutos < atual.fim;
  if (!seguinte) return andando ? atual.centro + FOLGA_DO_PONTO : atual.centro;
  const fracao = (minutos - atual.inicio) / (seguinte.inicio - atual.inicio);
  const posicao = atual.centro + fracao * (seguinte.centro - atual.centro);
  return andando ? Math.min(Math.max(posicao, atual.centro + FOLGA_DO_PONTO), seguinte.centro - FOLGA_DO_PONTO) : posicao;
}

// ---------- A tela ----------

export interface DescansoDeHoje extends RestStatus {
  /** O dia de hoje da sequência, o único que se pode marcar. */
  date: DateKey;
  marcado: boolean;
}

export interface DadosHoje {
  saudacao: string;
  foco: FocoDoTopo;
  diasSeguidos: number;
  /** A maior sequência já feita. */
  recorde: number;
  /** Os 7 dias da sequência, de onde sai a barra. */
  semana: StreakDay[];
  descanso: DescansoDeHoje;
  grafico: GraficoDaSemana;
  habitos: HabitoDeHoje[];
  tarefas: TarefaDeHoje[];
  linha: ItemDaLinha[];
  /** Minutos de agora desde 00:00 do dia lógico. */
  minutosAgora: number;
  /** Há algum bloco em toda a rotina (para o estado vazio). */
  temRotina: boolean;
}

export function descansoDeHoje(semana: readonly StreakDay[], restDays: readonly RestDay[]): DescansoDeHoje {
  const date = semana[indiceDeHoje(semana)]?.date ?? '';
  return { date, marcado: restDays.some((r) => r.date === date), ...situacaoDoDescanso(date, restDays) };
}

export async function carregarHoje(repo: Repository, clock: Clock, user: User, nome: string): Promise<DadosHoje> {
  const agora = clock.now();
  const fuso = user.timezone;
  const hoje = dateKeyOf(agora, fuso);
  const [blocks, habitos, habitLogs, sessions, restDays, goals, baus, tarefas, sequencia, preferencias] = await Promise.all([
    repo.listBlocks(),
    repo.listHabits(),
    repo.listHabitLogs(),
    repo.listSessions(),
    repo.listRestDays(),
    repo.listGoals(),
    repo.listGoalChests(),
    repo.listTasks(),
    verSequencia(repo, clock),
    verPreferencias(repo),
  ]);
  const alvos: Alvos = { habitos, metas: goals, tarefas };
  const deHoje = blocksForWeekday(blocks, weekdayOf(hoje));
  // A madrugada antes da virada continua o dia anterior.
  const relogio = localMinutesOf(agora, fuso);
  const minutosAgora = dateKeyOf(agora, fuso, 0) === hoje ? relogio : relogio + MINUTOS_DO_DIA;
  const proximo = proximoFoco({ blocks, sessions, now: agora, timeZone: fuso });
  const foco: FocoDoTopo = proximo
    ? {
        ...vinculoDoBloco(proximo.bloco.id, sessions, alvos),
        titulo: proximo.intencao ?? TITULO_DO_BLOCO.foco,
        minutos: Math.min(FOCUS.maxMinutes, Math.max(FOCUS.minMinutes, proximo.bloco.durationMinutes)),
      }
    : { busca: {}, alvo: null, titulo: null, minutos: preferencias.focusMinutes };
  const feitos = new Set(habitLogs.filter((r) => r.date === hoje).map((r) => r.habitId));
  return {
    saudacao: saudacao(agora, fuso, nome),
    foco,
    diasSeguidos: sequencia.atual,
    recorde: sequencia.recorde,
    semana: sequencia.semana,
    descanso: descansoDeHoje(sequencia.semana, restDays),
    grafico: graficoDaSemana({ semana: sequencia.semana, sessions, restDays, habitLogs, goals, baus, fuso }),
    habitos: habitsForDate(habitos, hoje).map((h) => ({ id: h.id, titulo: h.title, quando: quandoDoHabito(h), feito: feitos.has(h.id) })),
    tarefas: tarefasDeHoje(tarefas, hoje),
    linha: linhaDoDia({
      blocos: deHoje,
      sessions,
      alvos,
      descansoHoje: restDays.some((r) => r.date === hoje),
      hoje,
      minutos: minutosAgora,
      agora,
      fuso,
    }),
    minutosAgora,
    temRotina: blocks.length > 0,
  };
}

/** Marca ou desmarca o hábito no dia de hoje. */
export async function alternarHabito(repo: Repository, clock: Clock, user: User, habitId: string, feito: boolean): Promise<void> {
  const hoje = dateKeyOf(clock.now(), user.timezone);
  if (feito) await desmarcarHabito(repo, habitId, hoje);
  else await marcarHabito(repo, habitId, hoje, clock.now());
}

/** Marca ou desmarca o descanso de hoje. A regra recusada no app volta como resultado; a da API, como erro. */
export function alternarDescanso(repo: Repository, clock: Clock, { date, marcado }: DescansoDeHoje) {
  return marcado ? desmarcarDescanso(repo, clock, date) : marcarDescanso(repo, clock, date);
}

/** O quadradinho: de feita volta para "a fazer"; senão vai para "feito", com a hora. */
export async function alternarTarefa(repo: Repository, clock: Clock, taskId: string, feita: boolean): Promise<void> {
  await moverTarefa(repo, taskId, feita ? 'afazer' : 'feito', clock.now());
}
