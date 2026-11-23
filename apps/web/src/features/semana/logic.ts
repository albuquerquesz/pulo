import { WEEKLY_AI } from '@pulo/core/config/decisions';
import { dateKeyOf } from '@pulo/core/domain/day';
import { newId } from '@pulo/core/domain/ids';
import {
  acceptProposal,
  denyProposal,
  editProposal,
  generateWeeklyProposal,
  undoDecision,
  type ApprovalResult,
  type ProposalOutcome,
  type UndoToken,
  type WeeklyAiClient,
} from '@pulo/core/domain/ia';
import { refreshMascotState } from '@pulo/core/domain/phase';
import type { BlockSlot, Clock, MascotState, Repository, RoutineBlock, User, WeekSummary, WeeklyProposal } from '@pulo/core/domain/types';
import { loadWeekSummary } from '@pulo/core/domain/week-summary';
import { weekStartOf } from '@pulo/core/domain/day';

export interface DadosSemana {
  hoje: string;
  weekStart: string;
  resumo: WeekSummary;
  blocos: RoutineBlock[];
  mascote: MascotState;
  descansoHoje: boolean;
  /** Proposta já guardada para esta semana, se houver. */
  proposta: WeeklyProposal | null;
}

export async function carregarSemana(repo: Repository, clock: Clock, user: User): Promise<DadosSemana> {
  const agora = clock.now();
  const hoje = dateKeyOf(agora, user.timezone);
  const weekStart = weekStartOf(hoje);
  const [resumo, blocos, mascote, restDays, propostas] = await Promise.all([
    loadWeekSummary(repo, hoje, user.timezone),
    repo.listBlocks(),
    refreshMascotState(repo, user.timezone, agora).then((r) => r.state),
    repo.listRestDays(),
    repo.listProposals(),
  ]);
  return {
    hoje,
    weekStart,
    resumo,
    blocos,
    mascote,
    descansoHoje: restDays.some((r) => r.date === hoje),
    proposta: propostas.find((p) => p.weekStart === weekStart) ?? null,
  };
}

/** Gera e guarda a proposta da semana (uma por semana). Sem cliente de IA, vale a regra ("Sugestão"). */
export async function gerarEGuardarProposta(
  repo: Repository,
  clock: Clock,
  dados: DadosSemana,
  client: WeeklyAiClient | null,
): Promise<ProposalOutcome> {
  const now = clock.now();
  const proposals = await repo.listProposals();
  const out = await generateWeeklyProposal({
    summary: dados.resumo,
    blocks: dados.blocos,
    proposals,
    client,
    now,
    newId: () => newId(now, 'proposta'),
  });
  if (out.kind === 'proposta') await repo.saveProposal(out.proposal);
  return out;
}

export interface Decisao {
  proposal: WeeklyProposal;
  blocks: RoutineBlock[];
  undo: UndoToken;
}

async function gravar(repo: Repository, r: Extract<ApprovalResult, { ok: true }>): Promise<Decisao> {
  for (const b of r.blocks) await repo.saveBlock(b);
  await repo.saveProposal(r.proposal);
  return { proposal: r.proposal, blocks: r.blocks, undo: r.undo };
}

export type ResultadoDecisao = { ok: true; decisao: Decisao } | { ok: false; mensagem: string };

const MENSAGENS: Record<Extract<ApprovalResult, { ok: false }>['reason'], string> = {
  ja_decidida: 'Você já respondeu a esta sugestão.',
  bloco_inexistente: 'Esse bloco não existe mais.',
  horario_invalido: 'Esse horário não funciona. Tente outro.',
  conflito: 'Esse horário já está ocupado. Tente outro.',
};

export async function aceitar(repo: Repository, clock: Clock, proposal: WeeklyProposal): Promise<ResultadoDecisao> {
  const r = acceptProposal(proposal, await repo.listBlocks(), clock.now());
  return r.ok ? { ok: true, decisao: await gravar(repo, r) } : { ok: false, mensagem: MENSAGENS[r.reason] };
}

export async function editarHorario(repo: Repository, clock: Clock, proposal: WeeklyProposal, indice: number, novo: BlockSlot): Promise<ResultadoDecisao> {
  const r = editProposal(proposal, await repo.listBlocks(), indice, novo, clock.now());
  return r.ok ? { ok: true, decisao: await gravar(repo, r) } : { ok: false, mensagem: MENSAGENS[r.reason] };
}

export async function negar(repo: Repository, clock: Clock, proposal: WeeklyProposal): Promise<WeeklyProposal> {
  const next = denyProposal(proposal, clock.now());
  await repo.saveProposal(next);
  return next;
}

/** Desfaz dentro da janela: devolve a proposta antes da decisão e restaura os blocos. */
export async function desfazer(repo: Repository, clock: Clock, token: UndoToken): Promise<WeeklyProposal | null> {
  const r = undoDecision(token, clock.now());
  if (!r) return null;
  for (const b of r.blocks) await repo.saveBlock(b);
  await repo.saveProposal(r.proposal);
  return r.proposal;
}

export const JANELA_DE_DESFAZER_MS = WEEKLY_AI.undoSeconds * 1000;
