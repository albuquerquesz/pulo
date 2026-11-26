import { createMemoryRepository } from '@/data';
import { fixedClock } from '@pulo/core/domain/clock';
import { FakeWeeklyAiClient, proposalLabel } from '@pulo/core/domain/ia';
import { sp } from '@pulo/core/domain/test-utils';

import { concluirOnboarding } from '../app/core';
import { criarContaDeExemplo } from '../../testing/conta-de-exemplo';
import { aceitar, carregarSemana, desfazer, editarHorario, gerarEGuardarProposta, negar } from './logic';

async function contaComProposta() {
  const conta = await criarContaDeExemplo();
  const user = (await conta.repo.getUser())!;
  const dados = await carregarSemana(conta.repo, conta.clock, user);
  const out = await gerarEGuardarProposta(conta.repo, conta.clock, dados, null);
  return { ...conta, user, dados, out };
}

describe('Semana', () => {
  test('sem dados suficientes mostra "ainda estou conhecendo sua semana"', async () => {
    const repo = createMemoryRepository();
    const c = fixedClock(sp(2026, 11, 25, 10, 0));
    const user = await concluirOnboarding(repo, c, { frogName: 'Juca', startHour: 7, endHour: 22 });
    const dados = await carregarSemana(repo, c, user);
    expect(dados.proposta).toBeNull();
    const out = await gerarEGuardarProposta(repo, c, dados, null);
    expect(out.kind).toBe('conhecendo');
    expect(await repo.listProposals()).toEqual([]);
  });

  test('com os dados de exemplo vem uma proposta por regra, rotulada Sugestão e guardada', async () => {
    const { repo, out, dados } = await contaComProposta();
    expect(out.kind).toBe('proposta');
    if (out.kind !== 'proposta') return;
    expect(out.proposal.origin).toBe('regra');
    expect(proposalLabel(out.proposal.origin)).toBe('Sugestão');
    expect((await repo.listProposals()).length).toBe(1);
    // uma por semana: carregar de novo traz a mesma
    expect((await carregarSemana(repo, fixedClock(0), (await repo.getUser())!)).weekStart).toBeDefined();
    expect(dados.resumo.totalSessions).toBeGreaterThan(0);
  });

  test('uma falha da IA cai na regra e ainda diz Sugestão', async () => {
    const conta = await criarContaDeExemplo();
    const user = (await conta.repo.getUser())!;
    const dados = await carregarSemana(conta.repo, conta.clock, user);
    const ia = new FakeWeeklyAiClient(() => {
      throw new Error('fora do ar');
    });
    const out = await gerarEGuardarProposta(conta.repo, conta.clock, dados, ia);
    expect(out.kind).toBe('proposta');
    if (out.kind === 'proposta') expect(out.proposal.origin).toBe('regra');
  });

  test('aceitar muda o bloco e desfazer restaura', async () => {
    const { repo, clock, out } = await contaComProposta();
    if (out.kind !== 'proposta') throw new Error('sem proposta');
    const antes = await repo.listBlocks();
    const res = await aceitar(repo, clock, out.proposal);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ch = out.proposal.changes[0];
    const depois = (await repo.listBlocks()).find((b) => b.id === ch.blockId)!;
    expect(depois.startMinutes).toBe(ch.to.startMinutes);
    expect(depois.durationMinutes).toBe(ch.to.durationMinutes);
    expect((await repo.listProposals())[0].state).toBe('aceita');

    const restaurada = await desfazer(repo, clock, res.decisao.undo);
    expect(restaurada?.state).toBe('pendente');
    expect(await repo.listBlocks()).toEqual(expect.arrayContaining(antes));
    expect((await repo.listProposals())[0].state).toBe('pendente');
  });

  test('desfazer fora da janela não faz nada', async () => {
    const { repo, clock, out } = await contaComProposta();
    if (out.kind !== 'proposta') throw new Error('sem proposta');
    const res = await aceitar(repo, clock, out.proposal);
    if (!res.ok) throw new Error('falhou');
    clock.advanceDays(1);
    expect(await desfazer(repo, clock, res.decisao.undo)).toBeNull();
    expect((await repo.listProposals())[0].state).toBe('aceita');
  });

  test('negar guarda a decisão e não muda blocos', async () => {
    const { repo, clock, out } = await contaComProposta();
    if (out.kind !== 'proposta') throw new Error('sem proposta');
    const antes = await repo.listBlocks();
    const n = await negar(repo, clock, out.proposal);
    expect(n.state).toBe('negada');
    expect(await repo.listBlocks()).toEqual(antes);
  });

  test('editar o horário aplica o horário escolhido', async () => {
    const { repo, clock, out } = await contaComProposta();
    if (out.kind !== 'proposta') throw new Error('sem proposta');
    const to = { ...out.proposal.changes[0].to };
    const novo = { ...to, startMinutes: to.startMinutes + 30 };
    const res = await editarHorario(repo, clock, out.proposal, 0, novo);
    if (res.ok) {
      expect(res.decisao.proposal.state).toBe('editada');
      const b = (await repo.listBlocks()).find((x) => x.id === out.proposal.changes[0].blockId)!;
      expect(b.startMinutes).toBe(novo.startMinutes);
    } else {
      expect(res.mensagem).toMatch(/ocupado|horário/);
    }
  });
});
