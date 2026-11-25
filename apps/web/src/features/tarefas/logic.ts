import { TASKS } from '@pulo/core/config/decisions';
import { dateKeyOf, diffDays, weekEndOf } from '@pulo/core/domain/day';
import { MINUTE_MS } from '@pulo/core/domain/clock';
import { newId } from '@pulo/core/domain/ids';
import { columnTasks, matchesDueFilter, positionAt, positionBetween, TASK_COLUMNS } from '@pulo/core/domain/tasks';
import type { DateKey, Goal, Repository, Task, TaskEvent, TaskStatus, TaskSubtask } from '@pulo/core/domain/types';

export type Filtro = 'todas' | 'hoje' | 'semana';

export const FILTROS: readonly { chave: Filtro; rotulo: string }[] = [
  { chave: 'todas', rotulo: 'Todas' },
  { chave: 'hoje', rotulo: 'Hoje' },
  { chave: 'semana', rotulo: 'Esta semana' },
];

export const NOME_DA_COLUNA: Record<TaskStatus, string> = {
  ideias: 'Ideias',
  afazer: 'A fazer',
  fazendo: 'Fazendo',
  feito: 'Feito',
};

/** Espera sem digitar antes de gravar um texto. */
export const ESPERA_PARA_GRAVAR_MS = 500;

/** Estimativas oferecidas na lista de pomodoros. */
export const OPCOES_DE_POMODOROS: readonly number[] = [1, 2, 3, 4, 5, 6];

export interface Coluna {
  status: TaskStatus;
  nome: string;
  tarefas: Task[];
}

/** O quadro: as quatro colunas, cada uma de cima para baixo, só com o que passa no filtro. */
export function montarQuadro(tarefas: readonly Task[], filtro: Filtro, hoje: DateKey): Coluna[] {
  const visiveis = filtro === 'todas' ? tarefas : tarefas.filter((t) => matchesDueFilter(t, filtro, hoje));
  return TASK_COLUMNS.map((status) => ({ status, nome: NOME_DA_COLUNA[status], tarefas: columnTasks(visiveis, status) }));
}

// ---------- Arrastar ----------

/** O cartão antes do qual o ponteiro está: o primeiro cujo meio fica abaixo dele. Sem nenhum, é o fim da coluna. */
export function cartaoAbaixo(cartoes: readonly { id: string; meio: number }[], y: number): string | undefined {
  return cartoes.find((c) => c.meio > y)?.id;
}

/** Posição de quem é solto na coluna antes de `antesDe` (ou no fim). Conta a coluna inteira, mesmo com filtro. */
export function posicaoAoSoltar(tarefas: readonly Task[], status: TaskStatus, id: string, antesDe?: string): number {
  const outras = columnTasks(tarefas, status).filter((t) => t.id !== id);
  const i = outras.findIndex((t) => t.id === antesDe);
  return i < 0 ? positionAt(outras, 'fim') : positionBetween(outras[i - 1]?.position, outras[i]?.position);
}

export type Passo = 'subir' | 'descer';

/** Para o menu de mover do celular: o `antesDe` de um passo acima ou abaixo; `null` se já está na ponta. */
export function vizinhoDoPasso(visiveis: readonly Task[], id: string, passo: Passo): { antesDe: string | undefined } | null {
  const i = visiveis.findIndex((t) => t.id === id);
  if (i < 0) return null;
  if (passo === 'subir') return i === 0 ? null : { antesDe: visiveis[i - 1]?.id };
  return i === visiveis.length - 1 ? null : { antesDe: visiveis[i + 2]?.id };
}

// ---------- Prazo ----------

const diaEMes = (data: DateKey) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

/** O texto do prazo no cartão e na atividade. */
export function textoDoPrazo(prazo: DateKey, hoje: DateKey): string {
  if (prazo === hoje) return 'hoje';
  return prazo > hoje && prazo <= weekEndOf(hoje) ? 'esta semana' : diaEMes(prazo);
}

export type ValorDoPrazo = '' | 'hoje' | 'semana' | 'data';

export interface OpcaoDePrazo {
  valor: ValorDoPrazo;
  rotulo: string;
}

/** A lista de prazo da gaveta: uma data que não é hoje nem o domingo aparece como opção própria. */
export function prazoDaLista(prazo: DateKey | undefined, hoje: DateKey): { valor: ValorDoPrazo; opcoes: OpcaoDePrazo[] } {
  const opcoes: OpcaoDePrazo[] = [
    { valor: '', rotulo: 'Definir prazo' },
    { valor: 'hoje', rotulo: 'Hoje' },
    { valor: 'semana', rotulo: 'Esta semana' },
  ];
  if (prazo === undefined) return { valor: '', opcoes };
  if (prazo === hoje) return { valor: 'hoje', opcoes };
  if (prazo === weekEndOf(hoje)) return { valor: 'semana', opcoes };
  return { valor: 'data', opcoes: [...opcoes, { valor: 'data', rotulo: diaEMes(prazo) }] };
}

/** O prazo que uma escolha da lista grava ("esta semana" é o domingo). */
export function prazoEscolhido(valor: string, atual: DateKey | undefined, hoje: DateKey): DateKey | undefined {
  if (valor === 'hoje') return hoje;
  if (valor === 'semana') return weekEndOf(hoje);
  return valor === 'data' ? atual : undefined;
}

// ---------- Etiquetas e metas ----------

const ETIQUETAS_FIXAS = [
  { nome: 'Faculdade', cor: 'bg-etiqueta-azul' },
  { nome: 'Pessoal', cor: 'bg-etiqueta-rosa' },
  { nome: 'Saúde', cor: 'bg-foco' },
  { nome: 'Rotina', cor: 'bg-etiqueta-cinza' },
] as const;

export const corDaEtiqueta = (nome: string): string => ETIQUETAS_FIXAS.find((e) => e.nome === nome)?.cor ?? 'bg-sapo';

/** Corta sem partir um emoji ao meio, no limite de letras de uma etiqueta. */
function caber(texto: string): string {
  let saida = '';
  for (const letra of texto) {
    if (saida.length + letra.length > TASKS.tagMaxChars) break;
    saida += letra;
  }
  return saida.trim();
}

export const rotuloDaMeta = (meta: Goal, iconePadrao: string): string => `${meta.icon ?? iconePadrao} ${meta.title}`;

/** As etiquetas que ainda dá para pôr: as fixas e as das metas ativas. */
export function etiquetasLivres(atuais: readonly string[], metas: readonly Goal[], iconePadrao: string): string[] {
  if (atuais.length >= TASKS.maxTags) return [];
  const deMetas = metas.filter((m) => m.state === 'ativa').map((m) => caber(rotuloDaMeta(m, iconePadrao)));
  const todas = [...ETIQUETAS_FIXAS.map((e) => e.nome), ...deMetas];
  return [...new Set(todas)].filter((e) => !atuais.includes(e));
}

// ---------- Subtarefas ----------

export function subtarefasDa(subtarefas: readonly TaskSubtask[], taskId: string): TaskSubtask[] {
  return subtarefas.filter((s) => s.taskId === taskId).sort((a, b) => a.position - b.position);
}

export function novaSubtarefa(existentes: readonly TaskSubtask[], taskId: string, titulo: string, agora: number): TaskSubtask {
  return {
    id: newId(agora, 'subtarefa'),
    taskId,
    title: titulo.slice(0, TASKS.titleMaxChars),
    done: false,
    position: positionAt(existentes, 'fim'),
  };
}

// ---------- Atividade ----------

/** "agora", "há 5 min", "há 2 h", "ontem" ou "há 3 dias". */
export function haQuanto(quando: number, agora: number, fuso: string): string {
  const minutos = Math.floor((agora - quando) / MINUTE_MS);
  if (minutos < 1) return 'agora';
  const dias = diffDays(dateKeyOf(agora, fuso), dateKeyOf(quando, fuso));
  if (dias <= 0) return minutos < 60 ? `há ${minutos} min` : `há ${Math.floor(minutos / 60)} h`;
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
}

function nomeDaColuna(valor: string | undefined) {
  const coluna = TASK_COLUMNS.find((c) => c === valor);
  return coluna ? NOME_DA_COLUNA[coluna] : valor;
}

/** A frase do evento, depois do nome da pessoa. O prazo é lido em relação ao dia em que mudou. */
export function textoDoEvento(evento: TaskEvent, fuso: string): string {
  switch (evento.kind) {
    case 'criada':
      return 'criou a tarefa';
    case 'status':
      return `moveu para ${nomeDaColuna(evento.para)}`;
    case 'prioridade':
      return evento.para === 'alta' ? 'marcou prioridade alta' : 'removeu a prioridade';
    case 'prazo': {
      if (!evento.para) return 'removeu o prazo';
      const dia = dateKeyOf(evento.createdAt, fuso);
      const prazo = evento.para === dia ? 'hoje' : diaEMes(evento.para);
      return `definiu o prazo para ${prazo}`;
    }
  }
}

// ---------- Escritas ----------

export type CampoOpcional = 'description' | 'dueDate' | 'goalId';

/** Mudança de campos: nos opcionais, a chave presente com `undefined` apaga o valor. */
export type Mudanca = Partial<Pick<Task, 'title' | 'priority' | 'tags' | 'pomodorosEstimated' | CampoOpcional>>;

export function comMudanca(tarefa: Task, mudanca: Mudanca): Task {
  const nova: Task = { ...tarefa, ...mudanca };
  if (!nova.description) delete nova.description;
  if (nova.dueDate === undefined) delete nova.dueDate;
  if (nova.goalId === undefined) delete nova.goalId;
  return nova;
}

/** Grava a mudança sobre a tarefa como ela está agora. Tarefa já excluída não volta. */
export async function alterarTarefa(repo: Repository, id: string, mudanca: Mudanca): Promise<void> {
  const tarefa = (await repo.listTasks()).find((t) => t.id === id);
  if (tarefa) await repo.saveTask(comMudanca(tarefa, mudanca));
}

export async function alterarSubtarefa(repo: Repository, id: string, mudanca: Partial<Pick<TaskSubtask, 'title' | 'done'>>): Promise<void> {
  const subtarefa = (await repo.listSubtasks()).find((s) => s.id === id);
  if (subtarefa) await repo.saveSubtask({ ...subtarefa, ...mudanca });
}
