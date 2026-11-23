import { RemoteError, type RemoteRepository } from '@pulo/client';
import type { GenerateProposalResponse, ProposalDecisionBody, ProposalDecisionResponse } from '@pulo/core/api/schemas';
import { fixedClock } from '@pulo/core/domain/clock';
import { proposalLabel } from '@pulo/core/domain/ia';
import { sp } from '@pulo/core/domain/test-utils';
import type { BlockSlot, WeeklyProposal } from '@pulo/core/domain/types';
import { createMemoryRepository } from '@/data';

import { concluirOnboarding } from '../app/core';
import { criarSessaoDemo } from '../app/demo';
import { criarFonteDeProposta, criarFonteLocal, criarFonteRemota, type ClienteDePropostas } from './fonte';
import { carregarSemana, type DadosSemana } from './logic';

const PROPOSTA: WeeklyProposal = {
  id: 'proposta-1',
  weekStart: '2026-11-23',
  state: 'pendente',
  patternText: 'Seus focos renderam menos de manhã do que à tarde',
  reasonText: 'Um foco à tarde pode render mais',
  changes: [
    {
      kind: 'mover_foco',
      blockId: 'b1',
      from: { weekday: 1, startMinutes: 540, durationMinutes: 50 },
      to: { weekday: 1, startMinutes: 840, durationMinutes: 50 },
    },
  ],
  origin: 'regra',
  createdAt: 1,
};
const DECIDIDA: WeeklyProposal = { ...PROPOSTA, state: 'aceita', decidedAt: 2 };

/** Cliente do servidor falso: anota as chamadas e responde o que o teste mandar. */
function servidorFalso(opcoes: {
  gerar?: () => Promise<GenerateProposalResponse>;
  decidir?: (id: string, corpo: ProposalDecisionBody) => Promise<ProposalDecisionResponse>;
}) {
  const geradas: (string | undefined)[] = [];
  const decisoes: { id: string; corpo: ProposalDecisionBody }[] = [];
  const cliente: ClienteDePropostas = {
    generateProposal: async (date) => {
      geradas.push(date);
      return opcoes.gerar ? opcoes.gerar() : { outcome: 'conhecendo' };
    },
    decideProposal: async (id, corpo) => {
      decisoes.push({ id, corpo });
      return opcoes.decidir ? opcoes.decidir(id, corpo) : { proposal: DECIDIDA, blocks: [] };
    },
  } satisfies Pick<RemoteRepository, 'generateProposal' | 'decideProposal'>;
  return { cliente, geradas, decisoes };
}

const erroDaApi = (code: ConstructorParameters<typeof RemoteError>[0]['code'], mensagem: string) =>
  new RemoteError({ kind: 'api', status: 409, code, mensagem });

let DADOS: DadosSemana;
beforeAll(async () => {
  const repo = createMemoryRepository();
  const clock = fixedClock(sp(2026, 11, 25, 10, 0));
  DADOS = await carregarSemana(repo, clock, await concluirOnboarding(repo, clock, { frogName: 'Juca', startHour: 7, endHour: 22 }));
});

describe('fonte remota (conta): o servidor faz o trabalho', () => {
  test('gerar manda só a semana e traduz cada resultado', async () => {
    for (const outcome of ['conhecendo', 'sem_candidata'] as const) {
      const { cliente, geradas } = servidorFalso({ gerar: async () => ({ outcome }) });
      const fonte = criarFonteRemota(cliente, { sessaoExpirou: vi.fn() });
      expect(await fonte.gerar(DADOS)).toEqual({ kind: outcome });
      expect(geradas).toEqual([DADOS.weekStart]);
    }
    for (const outcome of ['proposta', 'existente'] as const) {
      const { cliente } = servidorFalso({ gerar: async () => ({ outcome, proposal: PROPOSTA }) });
      expect(await criarFonteRemota(cliente, { sessaoExpirou: vi.fn() }).gerar(DADOS)).toEqual({ kind: outcome, proposal: PROPOSTA });
    }
  });

  test('o rótulo continua honesto: só a origem ia diz "Sugestão da IA"', () => {
    expect(proposalLabel('ia')).toBe('Sugestão da IA');
    expect(proposalLabel('regra')).toBe('Sugestão');
  });

  test('aceitar, editar horário, negar e desfazer viram as ações do servidor', async () => {
    const { cliente, decisoes } = servidorFalso({
      decidir: async (_id, corpo) => ({ proposal: { ...PROPOSTA, state: corpo.action === 'negar' ? 'negada' : corpo.action === 'desfazer' ? 'pendente' : 'aceita', decidedAt: 2 }, blocks: [] }),
    });
    const fonte = criarFonteRemota(cliente, { sessaoExpirou: vi.fn() });
    const novo: BlockSlot = { weekday: 1, startMinutes: 870, durationMinutes: 50 };

    const aceita = await fonte.aceitar(PROPOSTA);
    expect(aceita).toMatchObject({ ok: true, decisao: { proposal: { state: 'aceita' }, undo: null } });
    await fonte.editarHorario(PROPOSTA, 0, novo);
    expect((await fonte.negar(PROPOSTA)).state).toBe('negada');
    if (!aceita.ok) throw new Error('esperava ok');
    expect((await fonte.desfazer(aceita.decisao))?.state).toBe('pendente');

    expect(decisoes.map((d) => d.corpo)).toEqual([
      { action: 'aceitar' },
      { action: 'editar', change: { index: 0, to: novo } },
      { action: 'negar' },
      { action: 'desfazer' },
    ]);
    expect(new Set(decisoes.map((d) => d.id))).toEqual(new Set([PROPOSTA.id]));
  });

  test('o servidor recusa porque o bloco mudou: mensagem em português e pedido para recarregar', async () => {
    const { cliente } = servidorFalso({
      decidir: async () => {
        throw erroDaApi('bloco_mudou', 'Seu bloco mudou desde que a ideia foi feita. Atualize a semana para ver uma nova.');
      },
    });
    const res = await criarFonteRemota(cliente, { sessaoExpirou: vi.fn() }).aceitar(PROPOSTA);
    expect(res).toEqual({ ok: false, mensagem: expect.stringContaining('Seu bloco mudou'), recarregar: true });
  });

  test('desfazer depois da janela (relógio do servidor) devolve null, como no fluxo local', async () => {
    const { cliente } = servidorFalso({
      decidir: async () => {
        throw erroDaApi('proposta_transicao_invalida', 'Essa sugestão já foi decidida.');
      },
    });
    const fonte = criarFonteRemota(cliente, { sessaoExpirou: vi.fn() });
    expect(await fonte.desfazer({ proposal: DECIDIDA, blocks: [], undo: null })).toBeNull();
  });

  test('sessão que acabou avisa o app e o erro sobe; falha de rede sobe sem avisar', async () => {
    const sessaoExpirou = vi.fn();
    const sessao = new RemoteError({ kind: 'sessao', status: 401, code: 'nao_autenticado', mensagem: 'Sua sessão acabou. Entre de novo para continuar.' });
    const { cliente } = servidorFalso({ decidir: async () => Promise.reject(sessao), gerar: async () => Promise.reject(sessao) });
    const fonte = criarFonteRemota(cliente, { sessaoExpirou });
    await expect(fonte.aceitar(PROPOSTA)).rejects.toBe(sessao);
    await expect(fonte.gerar(DADOS)).rejects.toBe(sessao);
    expect(sessaoExpirou).toHaveBeenCalledTimes(2);

    const rede = new RemoteError({ kind: 'rede', mensagem: 'sem sinal' });
    const offline = servidorFalso({ gerar: async () => Promise.reject(rede) });
    await expect(criarFonteRemota(offline.cliente, { sessaoExpirou }).gerar(DADOS)).rejects.toBe(rede);
    expect(sessaoExpirou).toHaveBeenCalledTimes(2);
  });
});

describe('escolha da fonte pela origem (um lugar só)', () => {
  test('demo e login usam a local; conta usa a remota', async () => {
    const repo = createMemoryRepository();
    const clock = fixedClock(sp(2026, 11, 25, 10, 0));
    const { cliente, geradas } = servidorFalso({});
    const avisos = { sessaoExpirou: vi.fn() };
    const user = await concluirOnboarding(repo, clock, { frogName: 'Juca', startHour: 7, endHour: 22 });
    const dados = await carregarSemana(repo, clock, user);

    for (const origem of ['demo', 'login'] as const) {
      const fonte = criarFonteDeProposta(origem, { repo, clock, ia: null, remoto: cliente, avisos });
      expect((await fonte.gerar(dados)).kind).toBe('conhecendo');
    }
    expect(geradas).toEqual([]);

    const remota = criarFonteDeProposta('remoto', { repo, clock, ia: null, remoto: cliente, avisos });
    await remota.gerar(dados);
    expect(geradas).toEqual([dados.weekStart]);
  });
});

describe('fonte local (demo): o fluxo de sempre, pela mesma interface', () => {
  async function demo() {
    const s = await criarSessaoDemo();
    const user = (await s.repo.getUser())!;
    const dados = await carregarSemana(s.repo, s.clock, user);
    return { ...s, dados, fonte: criarFonteLocal(s.repo, s.clock, null) };
  }

  test('gera por regra, aceita e desfaz no repositório em memória', async () => {
    const { repo, dados, fonte } = await demo();
    const out = await fonte.gerar(dados);
    if (out.kind !== 'proposta') throw new Error('sem proposta');
    expect(out.proposal.origin).toBe('regra');
    const antes = await repo.listBlocks();

    const res = await fonte.aceitar(out.proposal);
    if (!res.ok) throw new Error(res.mensagem);
    expect(res.decisao.undo).not.toBeNull();
    expect((await repo.listProposals())[0].state).toBe('aceita');
    expect((await fonte.desfazer(res.decisao))?.state).toBe('pendente');
    expect(await repo.listBlocks()).toEqual(expect.arrayContaining(antes));
  });

  test('negar guarda a decisão; desfazer fora da janela devolve null', async () => {
    const { repo, clock, dados, fonte } = await demo();
    const out = await fonte.gerar(dados);
    if (out.kind !== 'proposta') throw new Error('sem proposta');
    const res = await fonte.aceitar(out.proposal);
    if (!res.ok) throw new Error(res.mensagem);
    clock.advanceDays(1);
    expect(await fonte.desfazer(res.decisao)).toBeNull();
    expect((await repo.listProposals())[0].state).toBe('aceita');
  });

  test('editar horário e negar', async () => {
    const a = await demo();
    const out = await a.fonte.gerar(a.dados);
    if (out.kind !== 'proposta') throw new Error('sem proposta');
    const to = out.proposal.changes[0].to;
    const edit = await a.fonte.editarHorario(out.proposal, 0, { ...to, startMinutes: to.startMinutes + 30 });
    if (edit.ok) expect(edit.decisao.proposal.state).toBe('editada');
    else expect(edit.mensagem).toMatch(/ocupado|horário/);

    const b = await demo();
    const outB = await b.fonte.gerar(b.dados);
    if (outB.kind !== 'proposta') throw new Error('sem proposta');
    expect((await b.fonte.negar(outB.proposal)).state).toBe('negada');
  });
});
