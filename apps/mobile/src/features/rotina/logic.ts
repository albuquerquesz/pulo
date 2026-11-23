import { API_LIMITS } from '@pulo/core/api/schemas';
import { BLOCK_MAX_MINUTES, BLOCK_MIN_MINUTES, MAX_HABITS_PER_DAY } from '@pulo/core/config/decisions';
import {
  criarHabito,
  editarHabito,
  removerHabito,
  type HabitErrorCode,
} from '@pulo/core/domain/habits';
import {
  blocksForWeekday,
  criarBloco,
  desfazerBloco,
  editarBloco,
  encurtarBloco,
  moverBloco,
  removerBloco,
  type BlockInput,
  type RoutineError,
  type UndoToken,
} from '@pulo/core/domain/routine';
import type { Clock, EntityId, Habit, Repository, RoutineBlock, Weekday } from '@pulo/core/domain/types';

import { blocoTexto, diaCurto } from '../app/format';

export const DIAS_LONGOS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'] as const;
export const DIAS_DA_SEMANA: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export const TEXTO_DE_ERRO = 'A lagoa ficou sem sinal. Confira a internet e tente de novo.';
export const LIMITE_DE_TITULO = API_LIMITS.titleMaxChars;

// ---------- Leitura ----------

export interface DadosRotina {
  blocos: RoutineBlock[];
  habitos: Habit[];
}

/** Lê tudo do repositório (cache no remoto): sem consulta por item. */
export async function carregarRotina(repo: Repository): Promise<DadosRotina> {
  const [blocos, habitos] = await Promise.all([repo.listBlocks(), repo.listHabits()]);
  return { blocos, habitos };
}

export interface DiaDaRotina {
  dia: Weekday;
  nome: string;
  blocos: RoutineBlock[];
}

/** Os sete dias, em ordem, cada um com seus blocos por horário (dias vazios também aparecem). */
export function blocosPorDia(blocos: readonly RoutineBlock[]): DiaDaRotina[] {
  return DIAS_DA_SEMANA.map((dia) => ({ dia, nome: DIAS_LONGOS[dia], blocos: blocksForWeekday(blocos, dia) }));
}

export function rotuloDoBloco(b: RoutineBlock): string {
  return b.title ?? (b.kind === 'foco' ? 'Foco' : 'Descanso');
}

/** Frase para leitor de tela: "Segunda-feira, 9h a 9h25, foco, Estudar". */
export function descricaoDoBloco(b: RoutineBlock): string {
  const tipo = b.kind === 'foco' ? 'foco' : 'descanso';
  return `${DIAS_LONGOS[b.weekday]}, ${blocoTexto(b.startMinutes, b.durationMinutes)}, ${tipo}${b.title ? `, ${b.title}` : ''}`;
}

/** "Todos os dias", "Seg a Sex" ou "Seg, Qua e Sex". */
export function diasDoHabito(dias: readonly Weekday[]): string {
  const ordenados = [...dias].sort((a, b) => a - b);
  if (ordenados.length === 7) return 'Todos os dias';
  const seguidos = ordenados.length > 2 && ordenados.every((d, i) => i === 0 || d === ordenados[i - 1] + 1);
  if (seguidos) return `${diaCurto(ordenados[0])} a ${diaCurto(ordenados[ordenados.length - 1])}`;
  const nomes = ordenados.map(diaCurto);
  return nomes.length <= 1 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/** Quantos hábitos ativos cada dia da semana já tem. */
export function habitosAtivosPorDia(habitos: readonly Habit[]): number[] {
  return DIAS_DA_SEMANA.map((dia) => habitos.filter((h) => h.active && h.weekdays.includes(dia)).length);
}

// ---------- Horário digitado ----------

/** "9", "9:30", "09:30", "9h30" e "9h" viram minutos desde 00:00; qualquer outra coisa é `null`. */
export function lerHorario(texto: string): number | null {
  const m = /^\s*(\d{1,2})\s*(?:[:hH]\s*(\d{1,2})?)?\s*$/.exec(texto);
  if (!m) return null;
  const horas = Number(m[1]);
  const minutos = m[2] === undefined ? 0 : Number(m[2]);
  if (horas > 23 || minutos > 59) return null;
  return horas * 60 + minutos;
}

export function horarioParaCampo(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

// ---------- Formulário de bloco ----------

export interface EntradaDeBloco {
  weekday: Weekday;
  /** Texto do campo, ex.: "09:30". */
  inicio: string;
  /** Texto do campo, em minutos. */
  duracao: string;
  kind: RoutineBlock['kind'];
  titulo: string;
}

export function entradaVaziaDeBloco(inicioDoDia: number): EntradaDeBloco {
  return { weekday: 0, inicio: horarioParaCampo(inicioDoDia), duracao: '25', kind: 'foco', titulo: '' };
}

export function entradaDoBloco(b: RoutineBlock): EntradaDeBloco {
  return {
    weekday: b.weekday,
    inicio: horarioParaCampo(b.startMinutes),
    duracao: String(b.durationMinutes),
    kind: b.kind,
    titulo: b.title ?? '',
  };
}

export type CampoDeBloco = 'inicio' | 'duracao' | 'titulo' | 'geral';
export interface ErroDeFormulario<C extends string> {
  campo: C;
  mensagem: string;
}

/** Confere o que o campo de texto pode errar antes das regras do core (formato, número, tamanho do título). */
export function lerEntradaDeBloco(e: EntradaDeBloco): { ok: true; value: BlockInput } | { ok: false; erro: ErroDeFormulario<CampoDeBloco> } {
  const startMinutes = lerHorario(e.inicio);
  if (startMinutes === null) return { ok: false, erro: { campo: 'inicio', mensagem: 'Use o horário no formato 09:30.' } };
  const texto = e.duracao.trim();
  const durationMinutes = /^\d+$/.test(texto) ? Number(texto) : Number.NaN;
  if (!Number.isInteger(durationMinutes)) {
    return { ok: false, erro: { campo: 'duracao', mensagem: `Informe a duração em minutos, de ${BLOCK_MIN_MINUTES} a ${BLOCK_MAX_MINUTES}.` } };
  }
  const titulo = e.titulo.trim();
  if (titulo.length > LIMITE_DE_TITULO) {
    return { ok: false, erro: { campo: 'titulo', mensagem: `O título pode ter até ${LIMITE_DE_TITULO} letras.` } };
  }
  return { ok: true, value: { weekday: e.weekday, startMinutes, durationMinutes, kind: e.kind, ...(titulo ? { title: titulo } : {}) } };
}

/** Em que campo mostrar o erro de cada regra do core. */
function campoDoErro(erro: RoutineError): CampoDeBloco {
  switch (erro.code) {
    case 'duracao_invalida':
      return 'duracao';
    case 'horario_invalido':
    case 'sobreposicao':
      return 'inicio';
    default:
      return 'geral';
  }
}

export type ResultadoDoBloco =
  | { ok: true; bloco: RoutineBlock; desfazer: UndoToken | null }
  | { ok: false; erro: ErroDeFormulario<CampoDeBloco>; sugestaoDeInicio: string | null };

function falhaDoBloco(erro: RoutineError): ResultadoDoBloco {
  return {
    ok: false,
    erro: { campo: campoDoErro(erro), mensagem: erro.message },
    sugestaoDeInicio: erro.suggestedStartMinutes === undefined ? null : horarioParaCampo(erro.suggestedStartMinutes),
  };
}

/** Cria (`id` nulo) ou edita um bloco com as regras do core. Erros de rede sobem como `RemoteError`. */
export async function salvarBloco(repo: Repository, clock: Clock, entrada: EntradaDeBloco, id: EntityId | null): Promise<ResultadoDoBloco> {
  const lido = lerEntradaDeBloco(entrada);
  if (!lido.ok) return { ok: false, erro: lido.erro, sugestaoDeInicio: null };
  const now = clock.now();
  if (id === null) {
    const r = await criarBloco(repo, lido.value, now);
    return r.ok ? { ok: true, bloco: r.value, desfazer: null } : falhaDoBloco(r.error);
  }

  const atual = (await repo.listBlocks()).find((b) => b.id === id);
  if (!atual) return falhaDoBloco({ code: 'bloco_inexistente', message: 'Esse bloco não existe mais.' });
  const novo = lido.value;
  const mesmoTitulo = (novo.title ?? '') === (atual.title ?? '');
  const mesmoTipo = novo.kind === atual.kind;
  const mesmoLugar = novo.weekday === atual.weekday && novo.startMinutes === atual.startMinutes;
  const mesmaDuracao = novo.durationMinutes === atual.durationMinutes;

  // O core só entrega "desfazer" para mover e encurtar: usa esses caminhos quando a edição é só isso.
  if (mesmoTitulo && mesmoTipo && mesmaDuracao && !mesmoLugar) {
    const r = await moverBloco(repo, id, novo.weekday, novo.startMinutes, now);
    return r.ok ? { ok: true, bloco: r.value.block, desfazer: r.value.undo } : falhaDoBloco(r.error);
  }
  if (mesmoTitulo && mesmoTipo && mesmoLugar && novo.durationMinutes < atual.durationMinutes) {
    const r = await encurtarBloco(repo, id, novo.durationMinutes, now);
    return r.ok ? { ok: true, bloco: r.value.block, desfazer: r.value.undo } : falhaDoBloco(r.error);
  }
  // `title` sempre vai no patch: sem ele o core manteria o título antigo e não daria para apagá-lo.
  const r = await editarBloco(repo, id, { ...novo, title: novo.title });
  return r.ok ? { ok: true, bloco: r.value, desfazer: null } : falhaDoBloco(r.error);
}

export function desfazerEdicaoDeBloco(repo: Repository, clock: Clock, token: UndoToken) {
  return desfazerBloco(repo, token, clock.now());
}

export function removerDoBloco(repo: Repository, id: EntityId): Promise<void> {
  return removerBloco(repo, id);
}

// ---------- Formulário de hábito ----------

export interface EntradaDeHabito {
  titulo: string;
  dias: Weekday[];
  ativo: boolean;
}

export const entradaVaziaDeHabito: EntradaDeHabito = { titulo: '', dias: [0, 1, 2, 3, 4, 5, 6], ativo: true };

export function entradaDoHabito(h: Habit): EntradaDeHabito {
  return { titulo: h.title, dias: [...h.weekdays], ativo: h.active };
}

export type CampoDeHabito = 'titulo' | 'dias';

const CAMPO_DO_ERRO_DE_HABITO: Record<HabitErrorCode, CampoDeHabito | 'geral'> = {
  titulo_vazio: 'titulo',
  dias_invalidos: 'dias',
  limite_por_dia: 'dias',
  habito_inexistente: 'geral',
  data_invalida: 'geral',
};

export type ResultadoDoHabito =
  | { ok: true; habito: Habit }
  | { ok: false; erro: ErroDeFormulario<CampoDeHabito | 'geral'> };

/** Cria (`id` nulo) ou edita um hábito com as regras do core (nome, dias, limite por dia). */
export async function salvarHabito(repo: Repository, clock: Clock, entrada: EntradaDeHabito, id: EntityId | null): Promise<ResultadoDoHabito> {
  const titulo = entrada.titulo.trim();
  if (titulo.length > LIMITE_DE_TITULO) {
    return { ok: false, erro: { campo: 'titulo', mensagem: `O nome pode ter até ${LIMITE_DE_TITULO} letras.` } };
  }
  const r =
    id === null
      ? await criarHabito(repo, { title: titulo, weekdays: entrada.dias }, clock.now())
      : await editarHabito(repo, id, { title: titulo, weekdays: entrada.dias, active: entrada.ativo });
  return r.ok ? { ok: true, habito: r.value } : { ok: false, erro: { campo: CAMPO_DO_ERRO_DE_HABITO[r.error.code], mensagem: r.error.message } };
}

export function removerDoHabito(repo: Repository, id: EntityId): Promise<void> {
  return removerHabito(repo, id);
}

export const DICA_DE_LIMITE = `Cada dia comporta até ${MAX_HABITS_PER_DAY} hábitos ativos.`;
