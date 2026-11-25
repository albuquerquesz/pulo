import { isRemoteError, type RemoteRepository } from '@pulo/client';
import type { ProposalOutcome, UndoToken, WeeklyAiClient } from '@pulo/core/domain/ia';
import type { BlockSlot, Clock, Repository, RoutineBlock, WeeklyProposal } from '@pulo/core/domain/types';

import { verPreferencias } from '../app/conta';
import type { Origem } from '../app/origem';
import { aceitar, desfazer, editarHorario, gerarEGuardarProposta, negar, type DadosSemana, type Decisao } from './logic';

/** Uma decisão já aplicada. `undo` só existe na fonte local (a remota desfaz pelo servidor, pelo id da proposta). */
export interface DecisaoFeita {
  proposal: WeeklyProposal;
  blocks: RoutineBlock[];
  undo: UndoToken | null;
}

export type ResultadoDaDecisao =
  | { ok: true; decisao: DecisaoFeita }
  /** `recarregar`: o servidor recusou porque a tela estava desatualizada (ex.: bloco mexido em outro aparelho). */
  | { ok: false; mensagem: string; recarregar?: boolean };

/**
 * De onde vem a proposta da semana e quem aplica a decisão. A tela só conhece esta interface:
 * - fonte local (demo): o app calcula as candidatas, chama a IA aberta (`/weekly-ai`) e grava no repositório em memória;
 * - fonte remota (conta): o servidor faz tudo (dados, regras, IA, bloco e proposta na mesma transação).
 * Quem escolhe é `criarFonteDeProposta`, a partir da origem dos dados (`origem.ts`).
 */
export interface PropostaFonte {
  gerar(dados: DadosSemana): Promise<ProposalOutcome>;
  aceitar(proposta: WeeklyProposal): Promise<ResultadoDaDecisao>;
  editarHorario(proposta: WeeklyProposal, indice: number, novo: BlockSlot): Promise<ResultadoDaDecisao>;
  negar(proposta: WeeklyProposal): Promise<WeeklyProposal>;
  /** A proposta antes da decisão, ou `null` se o tempo para desfazer passou. */
  desfazer(decisao: DecisaoFeita): Promise<WeeklyProposal | null>;
}

const daLogica = (d: Decisao): DecisaoFeita => ({ proposal: d.proposal, blocks: d.blocks, undo: d.undo });

/** Fluxo local (demo): o que o app sempre fez, sobre o repositório em memória. */
export function criarFonteLocal(repo: Repository, clock: Clock, ia: WeeklyAiClient | null): PropostaFonte {
  const resultado = async (r: ReturnType<typeof aceitar>): Promise<ResultadoDaDecisao> => {
    const res = await r;
    return res.ok ? { ok: true, decisao: daLogica(res.decisao) } : res;
  };
  return {
    // Com o assistente desligado, só a regra: nada vai para o modelo.
    gerar: async (dados) => gerarEGuardarProposta(repo, clock, dados, (await verPreferencias(repo)).aiEnabled ? ia : null),
    aceitar: (proposta) => resultado(aceitar(repo, clock, proposta)),
    editarHorario: (proposta, indice, novo) => resultado(editarHorario(repo, clock, proposta, indice, novo)),
    negar: (proposta) => negar(repo, clock, proposta),
    desfazer: async (decisao) => (decisao.undo ? desfazer(repo, clock, decisao.undo) : null),
  };
}

/** Só o que a fonte remota usa do `RemoteRepository` (os testes passam um falso). */
export type ClienteDePropostas = Pick<RemoteRepository, 'generateProposal' | 'decideProposal'>;

export interface AvisosDaFonteRemota {
  /** A sessão acabou no meio do uso: volte para o login. */
  sessaoExpirou(): void;
}

/** Fluxo remoto (conta): chama as rotas do servidor. Falha de rede ou de sessão sobe como `RemoteError`; recusa do servidor vira mensagem. */
export function criarFonteRemota(remoto: ClienteDePropostas, avisos: AvisosDaFonteRemota): PropostaFonte {
  const tratar = (erro: unknown): never => {
    if (isRemoteError(erro) && erro.kind === 'sessao') avisos.sessaoExpirou();
    throw erro;
  };
  const decidir = async (proposta: WeeklyProposal, decisao: Parameters<ClienteDePropostas['decideProposal']>[1]): Promise<ResultadoDaDecisao> => {
    try {
      const { proposal, blocks } = await remoto.decideProposal(proposta.id, decisao);
      return { ok: true, decisao: { proposal, blocks, undo: null } };
    } catch (erro) {
      if (isRemoteError(erro) && erro.kind === 'api') {
        const desatualizado = erro.code === 'bloco_mudou' || erro.code === 'horario_ocupado' || erro.code === 'proposta_transicao_invalida';
        return { ok: false, mensagem: erro.mensagem, recarregar: desatualizado };
      }
      return tratar(erro);
    }
  };
  return {
    async gerar(dados) {
      try {
        const out = await remoto.generateProposal(dados.weekStart);
        return out.outcome === 'conhecendo' || out.outcome === 'sem_candidata'
          ? { kind: out.outcome }
          : { kind: out.outcome, proposal: out.proposal };
      } catch (erro) {
        return tratar(erro);
      }
    },
    aceitar: (proposta) => decidir(proposta, { action: 'aceitar' }),
    editarHorario: (proposta, indice, novo) => decidir(proposta, { action: 'editar', change: { index: indice, to: novo } }),
    async negar(proposta) {
      try {
        return (await remoto.decideProposal(proposta.id, { action: 'negar' })).proposal;
      } catch (erro) {
        return tratar(erro);
      }
    },
    async desfazer(decisao) {
      try {
        return (await remoto.decideProposal(decisao.proposal.id, { action: 'desfazer' })).proposal;
      } catch (erro) {
        // Janela vencida no relógio do servidor: o mesmo "o tempo para desfazer passou" do fluxo local.
        if (isRemoteError(erro) && erro.code === 'proposta_transicao_invalida') return null;
        return tratar(erro);
      }
    },
  };
}

export interface ContextoDaFonte {
  repo: Repository;
  clock: Clock;
  ia: WeeklyAiClient | null;
  /** O repositório da conta, quando a origem é `remoto`. */
  remoto?: ClienteDePropostas;
  avisos: AvisosDaFonteRemota;
}

/** O ÚNICO lugar que escolhe a fonte da proposta, pela mesma `Origem` que escolhe o repositório. */
export function criarFonteDeProposta(origem: Origem, ctx: ContextoDaFonte): PropostaFonte {
  if (origem === 'remoto' && ctx.remoto) return criarFonteRemota(ctx.remoto, ctx.avisos);
  return criarFonteLocal(ctx.repo, ctx.clock, ctx.ia);
}
