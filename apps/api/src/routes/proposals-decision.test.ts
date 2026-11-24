import { PROPOSAL_UNDO_GRACE_MS } from '@pulo/core/api/proposal-state';
import { type ProposalDecisionBody, generateProposalResponseSchema, proposalDecisionResponseSchema } from '@pulo/core/api/schemas';
import { WEEKLY_AI } from '@pulo/core/config/decisions';
import type { BlockSlot, RoutineBlock, WeeklyProposal } from '@pulo/core/domain/types';
import { type TestDatabase, createTestDatabase } from '@pulo/db/testing';
import { AFTERNOON_BLOCK, MORNING_BLOCK, WEEK, seedProposalWeek } from '../proposal-fixtures';
import { TEST_NOW, type TestUser, createHarness, queriesOf } from '../testing';

let database: TestDatabase;
let h: ReturnType<typeof createHarness>;

beforeAll(async () => {
  database = await createTestDatabase();
  h = createHarness(database);
});
afterEach(() => h.setNow(TEST_NOW));
afterAll(async () => {
  await database.close();
});

const UNDO_MS = WEEKLY_AI.undoSeconds * 1000;
const decide = (user: TestUser, id: string, body: ProposalDecisionBody | Record<string, unknown>) =>
  user.call('POST', `/api/proposals/${id}/decision`, body);
const errorOf = async (res: Response) => (await res.json()).error;
const blocksOf = async (user: TestUser): Promise<RoutineBlock[]> => (await (await user.call('GET', '/api/blocks')).json()).blocks;
const proposalsOf = async (user: TestUser): Promise<WeeklyProposal[]> => (await (await user.call('GET', '/api/proposals')).json()).proposals;
const slotOf = (b: RoutineBlock): BlockSlot => ({ weekday: b.weekday, startMinutes: b.startMinutes, durationMinutes: b.durationMinutes });

/** Pessoa com a semana de exemplo e a proposta já gerada pela API (pendente, mover o foco da manhã para a tarde). */
async function setup(extra = 0) {
  const me = await h.newUser();
  await seedProposalWeek(database.db, me.id, extra);
  const res = generateProposalResponseSchema.parse(await (await me.call('POST', '/api/proposals/generate', { date: WEEK })).json());
  if (res.outcome !== 'proposta') throw new Error(`sem proposta: ${res.outcome}`);
  const [change] = res.proposal.changes;
  return { me, proposal: res.proposal, change, blockId: change.blockId, before: await blocksOf(me) };
}

describe('POST /api/proposals/:id/decision', () => {
  it('exige sessão, Origin e corpo válido', async () => {
    const { me, proposal } = await setup();
    const url = `/api/proposals/${proposal.id}/decision`;
    expect((await h.app.request(url, { method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: '{"action":"negar"}' })).status).toBe(401);
    expect((await h.app.request(url, { method: 'POST', headers: { cookie: me.cookie, 'content-type': 'application/json' }, body: '{"action":"negar"}' })).status).toBe(403);
    const slot = { weekday: 1, startMinutes: 600, durationMinutes: 50 };
    for (const body of [{}, { action: 'apagar' }, { action: 'editar' }, { action: 'editar', change: { index: 0, to: { ...slot, durationMinutes: 3 } } }, { action: 'editar', change: { index: 9, to: slot } }, { action: 'editar', change: { index: 0, to: { ...slot, startMinutes: 1430 } } }]) {
      const res = await decide(me, proposal.id, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(await errorOf(res)).toBe('corpo_invalido');
    }
    expect((await decide(me, 'x'.repeat(65), { action: 'negar' })).status).toBe(400);
    expect(await errorOf(await decide(me, 'nao-existe', { action: 'negar' }))).toBe('nao_encontrado');
  });

  it('aceitar: aplica a mudança no bloco e marca a proposta aceita, na mesma resposta', async () => {
    const { me, proposal, change, blockId, before } = await setup();
    const res = await decide(me, proposal.id, { action: 'aceitar' });
    expect(res.status).toBe(200);
    const body = proposalDecisionResponseSchema.parse(await res.json());
    expect(body.proposal).toEqual({ ...proposal, state: 'aceita', decidedAt: TEST_NOW });
    const moved = body.blocks.find((b) => b.id === blockId);
    expect(moved && slotOf(moved)).toEqual(change.to);
    expect(moved?.title).toBe(before.find((b) => b.id === blockId)?.title);
    // Só esse bloco mudou, e o banco concorda com a resposta.
    expect(body.blocks.filter((b) => b.id !== blockId)).toEqual(before.filter((b) => b.id !== blockId));
    expect(await blocksOf(me)).toEqual(body.blocks);
    expect((await proposalsOf(me))[0]).toEqual(body.proposal);
  });

  it('editar: aplica o horário escolhido e guarda a proposta editada', async () => {
    const { me, proposal, change, blockId } = await setup();
    const to = { ...change.to, startMinutes: change.to.startMinutes + 30 };
    const res = await decide(me, proposal.id, { action: 'editar', change: { index: 0, to } });
    expect(res.status).toBe(200);
    const body = proposalDecisionResponseSchema.parse(await res.json());
    expect(body.proposal.state).toBe('editada');
    expect(body.proposal.changes[0]).toEqual({ ...change, to });
    expect(slotOf(body.blocks.find((b) => b.id === blockId) as RoutineBlock)).toEqual(to);
    expect(await blocksOf(me)).toEqual(body.blocks);
  });

  it('editar para um horário ocupado ou para uma mudança que não existe: nada muda', async () => {
    const { me, proposal, before } = await setup();
    const onAfternoon = { weekday: 2, startMinutes: 830, durationMinutes: 50 }; // bate no foco da tarde
    const busy = await decide(me, proposal.id, { action: 'editar', change: { index: 0, to: onAfternoon } });
    expect(busy.status).toBe(409);
    expect(await errorOf(busy)).toBe('horario_ocupado');
    const missing = await decide(me, proposal.id, { action: 'editar', change: { index: 1, to: { weekday: 1, startMinutes: 600, durationMinutes: 50 } } });
    expect(missing.status).toBe(400);
    expect(await blocksOf(me)).toEqual(before);
    expect((await proposalsOf(me))[0].state).toBe('pendente');
  });

  it('negar: guarda a decisão e não mexe nos blocos', async () => {
    const { me, proposal, before } = await setup();
    const body = proposalDecisionResponseSchema.parse(await (await decide(me, proposal.id, { action: 'negar' })).json());
    expect(body.proposal).toEqual({ ...proposal, state: 'negada', decidedAt: TEST_NOW });
    expect(body.blocks).toEqual(before);
    expect(await blocksOf(me)).toEqual(before);
  });

  describe('desfazer', () => {
    it('dentro da janela (relógio do servidor): a proposta volta a pendente e o bloco ao lugar', async () => {
      const { me, proposal, before } = await setup();
      await decide(me, proposal.id, { action: 'aceitar' });
      h.setNow(TEST_NOW + UNDO_MS);
      const res = await decide(me, proposal.id, { action: 'desfazer' });
      expect(res.status).toBe(200);
      const body = proposalDecisionResponseSchema.parse(await res.json());
      expect(body.proposal).toEqual(proposal);
      expect(body.proposal.decidedAt).toBeUndefined();
      expect(await blocksOf(me)).toEqual(before);
      expect((await proposalsOf(me))[0]).toEqual(proposal);
    });

    it('a janela inclui a folga de rede e fecha logo depois', async () => {
      const edge = await setup();
      await decide(edge.me, edge.proposal.id, { action: 'aceitar' });
      h.setNow(TEST_NOW + UNDO_MS + PROPOSAL_UNDO_GRACE_MS);
      expect((await decide(edge.me, edge.proposal.id, { action: 'desfazer' })).status).toBe(200);

      h.setNow(TEST_NOW);
      const late = await setup();
      const accepted = await (await decide(late.me, late.proposal.id, { action: 'aceitar' })).json();
      h.setNow(TEST_NOW + UNDO_MS + PROPOSAL_UNDO_GRACE_MS + 1);
      const res = await decide(late.me, late.proposal.id, { action: 'desfazer' });
      expect(res.status).toBe(409);
      expect(await errorOf(res)).toBe('proposta_transicao_invalida');
      // Nada mudou: o bloco segue no horário novo e a proposta segue aceita.
      expect(await blocksOf(late.me)).toEqual(accepted.blocks);
      expect((await proposalsOf(late.me))[0].state).toBe('aceita');
    });

    it('negada também desfaz (sem tocar nos blocos) e desfazer de pendente é idempotente', async () => {
      const { me, proposal, before } = await setup();
      expect((await decide(me, proposal.id, { action: 'desfazer' })).status).toBe(200);
      await decide(me, proposal.id, { action: 'negar' });
      const body = proposalDecisionResponseSchema.parse(await (await decide(me, proposal.id, { action: 'desfazer' })).json());
      expect(body.proposal.state).toBe('pendente');
      expect(await blocksOf(me)).toEqual(before);
    });

    it('editada volta ao horário de antes; a proposta fica pendente com o horário que a pessoa tinha escolhido', async () => {
      const { me, proposal, change, before } = await setup();
      const to = { ...change.to, startMinutes: change.to.startMinutes + 30 };
      await decide(me, proposal.id, { action: 'editar', change: { index: 0, to } });
      const body = proposalDecisionResponseSchema.parse(await (await decide(me, proposal.id, { action: 'desfazer' })).json());
      expect(body.proposal.state).toBe('pendente');
      expect(body.proposal.changes[0].to).toEqual(to);
      expect(await blocksOf(me)).toEqual(before);
    });

    it('depois de desfazer dá para decidir de novo', async () => {
      const { me, proposal } = await setup();
      await decide(me, proposal.id, { action: 'aceitar' });
      await decide(me, proposal.id, { action: 'desfazer' });
      expect((await decide(me, proposal.id, { action: 'negar' })).status).toBe(200);
    });
  });

  describe('decidir duas vezes segue a máquina de estados', () => {
    it('repetir a mesma decisão é idempotente: 200, mesma resposta, nada gravado de novo', async () => {
      const { me, proposal } = await setup();
      const first = await (await decide(me, proposal.id, { action: 'aceitar' })).json();
      h.setNow(TEST_NOW + 3000);
      const again = await decide(me, proposal.id, { action: 'aceitar' });
      expect(again.status).toBe(200);
      expect(await again.json()).toEqual(first);
      expect((await proposalsOf(me))[0].decidedAt).toBe(TEST_NOW);
      expect(await blocksOf(me)).toEqual(first.blocks);
      expect((await decide(me, proposal.id, { action: 'negar' })).status).toBe(409);
      await decide(me, proposal.id, { action: 'desfazer' });
      expect((await decide(me, proposal.id, { action: 'negar' })).status).toBe(200);
      expect((await decide(me, proposal.id, { action: 'negar' })).status).toBe(200);
    });

    it('outra decisão sobre uma já decidida dá 409 proposta_transicao_invalida', async () => {
      const { me, proposal, change } = await setup();
      await decide(me, proposal.id, { action: 'aceitar' });
      for (const body of [{ action: 'negar' }, { action: 'editar', change: { index: 0, to: { ...change.to, startMinutes: change.to.startMinutes + 30 } } }]) {
        const res = await decide(me, proposal.id, body);
        expect(res.status).toBe(409);
        expect(await errorOf(res)).toBe('proposta_transicao_invalida');
      }
      const denied = await setup();
      await decide(denied.me, denied.proposal.id, { action: 'negar' });
      expect(await errorOf(await decide(denied.me, denied.proposal.id, { action: 'aceitar' }))).toBe('proposta_transicao_invalida');
    });

    it('proposta expirada é final', async () => {
      const { me, proposal } = await setup();
      await database.db.weeklyProposal.update({ where: { id: proposal.id }, data: { state: 'expirada', decidedAt: new Date(TEST_NOW) } });
      for (const action of ['aceitar', 'negar', 'desfazer'] as const) {
        expect(await errorOf(await decide(me, proposal.id, { action }))).toBe('proposta_transicao_invalida');
      }
    });

    it('dois "aceitar" ao mesmo tempo: o bloco muda uma vez e a proposta termina aceita', async () => {
      const { me, proposal, change, blockId } = await setup();
      const results = await Promise.all([decide(me, proposal.id, { action: 'aceitar' }), decide(me, proposal.id, { action: 'aceitar' })]);
      for (const res of results) expect([200, 409]).toContain(res.status);
      expect(results.some((res) => res.status === 200)).toBe(true);
      const block = (await blocksOf(me)).find((b) => b.id === blockId) as RoutineBlock;
      expect(slotOf(block)).toEqual(change.to);
      expect((await proposalsOf(me))[0].state).toBe('aceita');
    });
  });

  describe('o bloco mudou desde a proposta: 409 bloco_mudou e nada é gravado', () => {
    it('bloco movido por outro aparelho', async () => {
      const { me, proposal, blockId, before } = await setup();
      const original = before.find((b) => b.id === blockId) as RoutineBlock;
      await me.call('PUT', `/api/blocks/${blockId}`, { ...original, startMinutes: original.startMinutes + 60 });
      const after = await blocksOf(me);
      const res = await decide(me, proposal.id, { action: 'aceitar' });
      expect(res.status).toBe(409);
      expect(await errorOf(res)).toBe('bloco_mudou');
      expect(await blocksOf(me)).toEqual(after);
      expect((await proposalsOf(me))[0].state).toBe('pendente');
    });

    it('bloco com outra duração, ou apagado', async () => {
      const { me, proposal, blockId, before } = await setup();
      const original = before.find((b) => b.id === blockId) as RoutineBlock;
      await me.call('PUT', `/api/blocks/${blockId}`, { ...original, durationMinutes: 45 });
      expect(await errorOf(await decide(me, proposal.id, { action: 'aceitar' }))).toBe('bloco_mudou');
      await me.call('DELETE', `/api/blocks/${blockId}`);
      expect(await errorOf(await decide(me, proposal.id, { action: 'editar', change: { index: 0, to: { weekday: 1, startMinutes: 600, durationMinutes: 50 } } }))).toBe('bloco_mudou');
      expect((await proposalsOf(me))[0].state).toBe('pendente');
    });

    it('desfazer não sobrescreve um bloco que a pessoa mexeu depois de aceitar', async () => {
      const { me, proposal, blockId } = await setup();
      const accepted = proposalDecisionResponseSchema.parse(await (await decide(me, proposal.id, { action: 'aceitar' })).json());
      const moved = accepted.blocks.find((b) => b.id === blockId) as RoutineBlock;
      await me.call('PUT', `/api/blocks/${blockId}`, { ...moved, startMinutes: moved.startMinutes + 30 });
      const after = await blocksOf(me);
      expect(await errorOf(await decide(me, proposal.id, { action: 'desfazer' }))).toBe('bloco_mudou');
      expect(await blocksOf(me)).toEqual(after);
      expect((await proposalsOf(me))[0].state).toBe('aceita');
    });

    it('outro bloco ocupou o destino: 409 horario_ocupado', async () => {
      const { me, proposal, change, before } = await setup();
      await me.call('PUT', '/api/blocks/intruso', { id: 'intruso', weekday: change.to.weekday, startMinutes: change.to.startMinutes, durationMinutes: 30, kind: 'descanso' });
      const res = await decide(me, proposal.id, { action: 'aceitar' });
      expect(res.status).toBe(409);
      expect(await errorOf(res)).toBe('horario_ocupado');
      expect((await blocksOf(me)).filter((b) => b.id !== 'intruso')).toEqual(before);
    });
  });

  it('é uma transação só: se a gravação da proposta falha, o bloco também volta', async () => {
    const { me, proposal, before } = await setup();
    await database.db.$executeRawUnsafe(`
      CREATE FUNCTION pulo_test_fail() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'falha de teste'; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER pulo_test_fail BEFORE UPDATE ON "weekly_proposal" FOR EACH ROW EXECUTE FUNCTION pulo_test_fail();`);
    try {
      const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const res = await decide(me, proposal.id, { action: 'aceitar' });
      quiet.mockRestore();
      expect(res.status).toBe(500);
      expect(await errorOf(res)).toBe('erro_interno');
    } finally {
      await database.db.$executeRawUnsafe('DROP TRIGGER pulo_test_fail ON "weekly_proposal"; DROP FUNCTION pulo_test_fail();');
    }
    expect(await blocksOf(me)).toEqual(before);
    expect((await proposalsOf(me))[0].state).toBe('pendente');
  });

  it('isolamento: outra pessoa não decide a proposta alheia nem mexe nos blocos dela', async () => {
    const a = await setup();
    const b = await h.newUser();
    for (const action of ['aceitar', 'negar', 'desfazer'] as const) {
      const res = await decide(b, a.proposal.id, { action });
      expect(res.status).toBe(404);
      expect(await errorOf(res)).toBe('nao_encontrado');
    }
    expect(await blocksOf(a.me)).toEqual(a.before);
    expect((await proposalsOf(a.me))[0].state).toBe('pendente');
    expect(await proposalsOf(b)).toEqual([]);
  });

  it('queries: o número é fixo com 1 e com 50 blocos', async () => {
    const small = await setup(0);
    const big = await setup(49);
    expect([small.before.length, big.before.length]).toEqual([2, 51]);
    const path = (s: { proposal: WeeklyProposal }) => `/api/proposals/${s.proposal.id}/decision`;
    const accept = { action: 'aceitar' };

    // 2 da sessão + proposta + blocos + UPDATE dos blocos + UPDATE da proposta.
    expect(await queriesOf(database, small.me, 'POST', path(small), accept)).toBe(6);
    expect(await queriesOf(database, big.me, 'POST', path(big), accept)).toBe(6);
    // Repetir: só as duas leituras.
    expect(await queriesOf(database, small.me, 'POST', path(small), accept)).toBe(4);
    expect(await queriesOf(database, big.me, 'POST', path(big), accept)).toBe(4);
    // Desfazer devolve o bloco ao lugar: mesmas 6.
    const undo = { action: 'desfazer' };
    expect(await queriesOf(database, small.me, 'POST', path(small), undo)).toBe(6);
    expect(await queriesOf(database, big.me, 'POST', path(big), undo)).toBe(6);
    // Negar não grava blocos: 5. Proposta que não existe: 3.
    const deny = { action: 'negar' };
    expect(await queriesOf(database, small.me, 'POST', path(small), deny)).toBe(5);
    expect(await queriesOf(database, big.me, 'POST', path(big), deny)).toBe(5);
    expect(await queriesOf(database, big.me, 'POST', '/api/proposals/nao-existe/decision', deny, 404)).toBe(3);
  });
});
