// Propostas no servidor, pelo cliente tipado, contra a API de verdade no mesmo processo (sem rede, sem mock da API).
import { WEEK, seedProposalWeek } from '@pulo/api/src/proposal-fixtures';
import { TEST_NOW, TEST_ORIGIN, type TestUser, createHarness } from '@pulo/api/src/testing';
import { FakeProvider } from '@pulo/api/src/weekly-ai';
import type { GenerateProposalResponse, ProposalDecisionResponse } from '@pulo/core/api/schemas';
import { WEEKLY_AI } from '@pulo/core/config/decisions';
import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { type FetchLike, RemoteError, createRemoteRepository } from './index';

let database: TestDatabase;
let h: ReturnType<typeof createHarness>;
let withAi: ReturnType<typeof createHarness>;

beforeAll(async () => {
  database = await createTestDatabase();
  h = createHarness(database);
  withAi = createHarness(database, { provider: new FakeProvider() });
});
afterEach(() => h.setNow(TEST_NOW));
afterAll(async () => {
  await database.close();
});

const clock = { now: () => TEST_NOW };

function open(me: TestUser, app: ReturnType<typeof createHarness> = h, calls: string[] = []) {
  const fetch: FetchLike = (request) => {
    calls.push(`${request.method} ${new URL(request.url).pathname}`);
    const headers = new Headers(request.headers);
    headers.set('cookie', me.cookie);
    headers.set('origin', TEST_ORIGIN);
    return app.app.fetch(new Request(request, { headers }));
  };
  return createRemoteRepository({ baseUrl: 'http://api.test', fetch, clock, retries: 0 });
}

async function setup(app = h) {
  const me = await app.newUser();
  await seedProposalWeek(database.db, me.id);
  const calls: string[] = [];
  const repo = await open(me, app, calls);
  const out = await repo.generateProposal(WEEK);
  if (out.outcome !== 'proposta') throw new Error(`sem proposta: ${out.outcome}`);
  return { me, repo, calls, proposal: out.proposal, change: out.proposal.changes[0] };
}

describe('generateProposal', () => {
  it('poucos dados: "conhecendo", sem proposta no cache', async () => {
    const repo = await open(await h.newUser());
    const out = await repo.generateProposal(WEEK);
    expect(out).toEqual({ outcome: 'conhecendo' });
    expect(await repo.listProposals()).toEqual([]);
  });

  it('uma chamada, proposta por regra no cache e a mesma volta na segunda vez', async () => {
    const me = await h.newUser();
    await seedProposalWeek(database.db, me.id);
    const calls: string[] = [];
    const repo = await open(me, h, calls);
    const first = await repo.generateProposal();
    expectTypeOf(first).toEqualTypeOf<GenerateProposalResponse>();
    expect(first.outcome).toBe('proposta');
    if (first.outcome !== 'proposta') return;
    expect(first.proposal).toMatchObject({ weekStart: WEEK, state: 'pendente', origin: 'regra' });
    expect(await repo.listProposals()).toEqual([first.proposal]);
    const second = await repo.generateProposal();
    expect(second).toEqual({ outcome: 'existente', proposal: first.proposal });
    expect(calls).toEqual(['GET /api/sync', 'POST /api/proposals/generate', 'POST /api/proposals/generate']);
    // Outro aparelho enxerga a mesma proposta.
    expect(await (await open(me)).listProposals()).toEqual([first.proposal]);
  });

  it('com a IA ligada no servidor a origem é ia', async () => {
    const { proposal } = await setup(withAi);
    expect(proposal.origin).toBe('ia');
  });

  it('resposta fora do contrato vira RemoteError "resposta_invalida"', async () => {
    const me = await h.newUser();
    const broken: FetchLike = (request) =>
      new URL(request.url).pathname === '/api/sync' ? h.app.fetch(withCookie(request, me)) : Response.json({ outcome: 'inventado' });
    const repo = await createRemoteRepository({ baseUrl: 'http://api.test', fetch: broken, clock, retries: 0 });
    await expect(repo.generateProposal()).rejects.toMatchObject({ kind: 'resposta_invalida' });
  });
});

function withCookie(request: Request, me: TestUser): Request {
  const headers = new Headers(request.headers);
  headers.set('cookie', me.cookie);
  headers.set('origin', TEST_ORIGIN);
  return new Request(request, { headers });
}

describe('decideProposal', () => {
  it('aceitar troca o bloco e a proposta no cache com UMA chamada; desfazer volta tudo', async () => {
    const { repo, calls, proposal, change } = await setup();
    const before = await repo.listBlocks();
    calls.length = 0;
    const accepted = await repo.decideProposal(proposal.id, { action: 'aceitar' });
    expectTypeOf(accepted).toEqualTypeOf<ProposalDecisionResponse>();
    expect(calls).toEqual([`POST /api/proposals/${proposal.id}/decision`]);
    expect(accepted.proposal).toMatchObject({ state: 'aceita', decidedAt: TEST_NOW });
    const moved = (await repo.listBlocks()).find((b) => b.id === change.blockId);
    expect(moved).toMatchObject(change.to);
    expect((await repo.listProposals())[0].state).toBe('aceita');

    h.setNow(TEST_NOW + WEEKLY_AI.undoSeconds * 1000);
    const undone = await repo.decideProposal(proposal.id, { action: 'desfazer' });
    expect(undone.proposal).toEqual(proposal);
    expect(await repo.listBlocks()).toEqual(before);
    expect((await repo.listProposals())[0]).toEqual(proposal);
  });

  it('editar e negar', async () => {
    const edit = await setup();
    const to = { ...edit.change.to, startMinutes: edit.change.to.startMinutes + 30 };
    const edited = await edit.repo.decideProposal(edit.proposal.id, { action: 'editar', change: { index: 0, to } });
    expect(edited.proposal.state).toBe('editada');
    expect((await edit.repo.listBlocks()).find((b) => b.id === edit.change.blockId)).toMatchObject(to);

    const deny = await setup();
    const before = await deny.repo.listBlocks();
    const denied = await deny.repo.decideProposal(deny.proposal.id, { action: 'negar' });
    expect(denied.proposal.state).toBe('negada');
    expect(await deny.repo.listBlocks()).toEqual(before);
  });

  it('desfazer depois da janela: RemoteError com o código e o texto em português; o cache segue consistente', async () => {
    const { repo, proposal } = await setup();
    await repo.decideProposal(proposal.id, { action: 'aceitar' });
    h.setNow(TEST_NOW + (WEEKLY_AI.undoSeconds + 60) * 1000);
    const error = await repo.decideProposal(proposal.id, { action: 'desfazer' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RemoteError);
    expect(error).toMatchObject({ kind: 'api', status: 409, code: 'proposta_transicao_invalida', mensagem: 'Essa sugestão já foi decidida.' });
    expect((await repo.listProposals())[0].state).toBe('aceita');
  });

  it('bloco mexido em outro aparelho: bloco_mudou, e o cache é relido', async () => {
    const { me, repo, proposal, change } = await setup();
    const other = await open(me);
    const block = (await other.listBlocks()).find((b) => b.id === change.blockId);
    if (!block) throw new Error('sem bloco');
    await other.saveBlock({ ...block, startMinutes: block.startMinutes + 60 });
    expect((await repo.listBlocks()).find((b) => b.id === block.id)?.startMinutes).toBe(block.startMinutes);

    await expect(repo.decideProposal(proposal.id, { action: 'aceitar' })).rejects.toMatchObject({ code: 'bloco_mudou', status: 409 });
    expect((await repo.listBlocks()).find((b) => b.id === block.id)?.startMinutes).toBe(block.startMinutes + 60);
    expect((await repo.listProposals())[0].state).toBe('pendente');
  });

  it('proposta de outra pessoa: nao_encontrado', async () => {
    const { proposal } = await setup();
    const repo = await open(await h.newUser());
    await expect(repo.decideProposal(proposal.id, { action: 'negar' })).rejects.toMatchObject({ kind: 'api', status: 404, code: 'nao_encontrado' });
    expect(await repo.listProposals()).toEqual([]);
  });
});
