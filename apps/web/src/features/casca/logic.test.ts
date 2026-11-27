import { createMemoryRepository } from '@/data';
import type { Goal } from '@pulo/core/domain/types';

import { criarContaDeExemplo } from '../../testing/conta-de-exemplo';
import { abaAtiva, carregarTrilho, metasDoTrilho, minutosDeFocoDoDia, telaDeImersao } from './logic';

const meta = (id: string, extra: Partial<Goal> = {}): Goal => ({ id, title: id, state: 'ativa', milestones: [], createdAt: 0, ...extra });

describe('navegação', () => {
  test('a aba acesa segue o caminho; Casa e Perfil não têm item no menu', () => {
    expect(abaAtiva('/')).toBe('hoje');
    expect(abaAtiva('/habitos')).toBe('habitos');
    expect(abaAtiva('/casa')).toBeNull();
    expect(abaAtiva('/perfil')).toBeNull();
  });
  test('Casa, Ilha e Tarefas são de imersão', () => {
    expect(['/casa', '/ilha', '/tarefas'].every(telaDeImersao)).toBe(true);
    expect(['/', '/habitos', '/metas', '/perfil'].some(telaDeImersao)).toBe(false);
  });
});

describe('metas do trilho', () => {
  test('ativas por prazo, depois concluídas, no máximo três', () => {
    const metas = [
      meta('feita', { state: 'concluida', completedAt: 1 }),
      meta('sem-prazo'),
      meta('perto', { targetDate: '2026-12-01' }),
      meta('longe', { targetDate: '2027-03-01' }),
    ];
    expect(metasDoTrilho(metas, []).map((m) => m.id)).toEqual(['perto', 'longe', 'sem-prazo']);
    expect(metasDoTrilho(metas.slice(0, 2), []).map((m) => m.id)).toEqual(['sem-prazo', 'feita']);
  });
  test('baú só aparece aberto depois de resgatado; sem marcos conta como um passo', () => {
    const feita = meta('feita', { state: 'concluida' });
    expect(metasDoTrilho([feita], [])[0]).toMatchObject({ feito: 1, total: 1, concluida: true, bauAberto: false });
    expect(metasDoTrilho([feita], [{ goalId: 'feita', abertoEm: 1, joias: 1 }])[0].bauAberto).toBe(true);
  });
});

describe('números do dia', () => {
  test('o foco soma só as sessões encerradas no dia', () => {
    const base = { plannedMinutes: 25, pausedMs: 0, state: 'concluida' } as const;
    const inicio = Date.parse('2026-11-22T12:00:00Z');
    const sessoes = [
      { ...base, id: 'a', startedAt: inicio, endedAt: inicio + 25 * 60_000 },
      { ...base, id: 'b', startedAt: inicio - 86_400_000, endedAt: inicio - 86_400_000 + 25 * 60_000 },
    ];
    expect(minutosDeFocoDoDia(sessoes, '2026-11-22', 'America/Sao_Paulo')).toBe(25);
  });
  test('a conta de exemplo tem o que o trilho mostra', async () => {
    const { repo, clock } = await criarContaDeExemplo();
    const user = await repo.getUser();
    if (!user) throw new Error('conta de exemplo sem usuário');
    const dados = await carregarTrilho(repo, clock, user);
    expect(dados.habitos).toEqual({ feitos: 2, total: 4 });
    expect(dados.minutosDeFoco).toBe(50);
    expect(dados.sequencia).toBeGreaterThan(1);
    expect(dados.joias).toBeGreaterThan(0);
    // A casa de exemplo já vem pela metade.
    expect(dados.partesConstruidas).toHaveLength(12);
    expect(dados.totalDePartes).toBe(24);
    expect(dados.metas.map((m) => `${m.feito}/${m.total}`)).toEqual(['3/5', '1/4', '5/5']);
  });
  test('sem registros tudo é zero', async () => {
    const repo = createMemoryRepository();
    const { clock, repo: exemplo } = await criarContaDeExemplo();
    const user = await exemplo.getUser();
    if (!user) throw new Error('conta de exemplo sem usuário');
    expect(await carregarTrilho(repo, clock, user)).toMatchObject({ sequencia: 0, minutosDeFoco: 0, joias: 0, metas: [] });
  });
});
