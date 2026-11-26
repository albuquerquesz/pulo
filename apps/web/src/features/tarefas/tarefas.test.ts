import { TASKS } from '@pulo/core/config/decisions';
import { moverTarefa, verPomodoros } from '@pulo/core/domain/tasks';
import type { Goal, Task } from '@pulo/core/domain/types';

import { comAvisosDeErro } from '../app/repositorio';
import { criarContaDeExemplo } from '../../testing/conta-de-exemplo';
import {
  alterarTarefa,
  cartaoAbaixo,
  comMudanca,
  etiquetasLivres,
  haQuanto,
  montarQuadro,
  posicaoAoSoltar,
  prazoDaLista,
  prazoEscolhido,
  textoDoEvento,
  textoDoPrazo,
  vizinhoDoPasso,
} from './logic';

// Sábado; o domingo da semana é 22/11.
const HOJE = '2026-11-21';
const FUSO = 'America/Sao_Paulo';

const tarefa = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  title: id,
  status: 'afazer',
  position: 1000,
  priority: 'normal',
  tags: [],
  pomodorosEstimated: 0,
  createdAt: 0,
  ...extra,
});
const COLUNA = [tarefa('a', { position: 1000 }), tarefa('b', { position: 2000 }), tarefa('c', { position: 3000 })];

describe('quadro', () => {
  const tarefas = [
    tarefa('hoje', { dueDate: HOJE }),
    tarefa('atrasada', { dueDate: '2026-11-18', position: 500 }),
    tarefa('domingo', { dueDate: '2026-11-22', status: 'feito' }),
    tarefa('longe', { dueDate: '2026-12-01' }),
    tarefa('sem', { status: 'ideias' }),
  ];
  const ids = (filtro: Parameters<typeof montarQuadro>[1]) => montarQuadro(tarefas, filtro, HOJE).map((c) => c.tarefas.map((t) => t.id));

  test('quatro colunas na ordem, cada uma pela posição', () => {
    expect(montarQuadro(tarefas, 'todas', HOJE).map((c) => c.nome)).toEqual(['Ideias', 'A fazer', 'Fazendo', 'Feito']);
    expect(ids('todas')).toEqual([['sem'], ['atrasada', 'hoje', 'longe'], [], ['domingo']]);
  });

  test('filtros por prazo, com as contagens de cada coluna', () => {
    expect(ids('hoje')).toEqual([[], ['atrasada', 'hoje'], [], []]);
    expect(ids('semana')).toEqual([[], ['atrasada', 'hoje'], [], ['domingo']]);
  });
});

describe('soltar', () => {
  test('entre dois cartões usa a média; nas pontas usa o passo', () => {
    expect(posicaoAoSoltar(COLUNA, 'afazer', 'c', 'b')).toBe(1500);
    expect(posicaoAoSoltar(COLUNA, 'afazer', 'c', 'a')).toBe(1000 - TASKS.positionStep);
    expect(posicaoAoSoltar(COLUNA, 'afazer', 'a')).toBe(3000 + TASKS.positionStep);
    expect(posicaoAoSoltar(COLUNA, 'feito', 'a')).toBe(TASKS.positionStep);
  });

  test('o cartão abaixo do ponteiro e o passo do menu de mover', () => {
    const meios = [{ id: 'a', meio: 10 }, { id: 'b', meio: 30 }];
    expect([cartaoAbaixo(meios, 5), cartaoAbaixo(meios, 20), cartaoAbaixo(meios, 40)]).toEqual(['a', 'b', undefined]);
    expect(vizinhoDoPasso(COLUNA, 'b', 'subir')).toEqual({ antesDe: 'a' });
    expect(vizinhoDoPasso(COLUNA, 'b', 'descer')).toEqual({ antesDe: undefined });
    expect(vizinhoDoPasso(COLUNA, 'a', 'subir')).toBeNull();
    expect(vizinhoDoPasso(COLUNA, 'c', 'descer')).toBeNull();
  });

  test('ir para Feito grava completedAt e sair limpa', async () => {
    const { repo, clock } = await criarContaDeExemplo();
    const feita = async () => (await repo.listTasks()).find((t) => t.id === 'ex-tarefa-4');
    await moverTarefa(repo, 'ex-tarefa-4', 'feito', clock.now());
    expect((await feita())?.completedAt).toBe(clock.now());
    await moverTarefa(repo, 'ex-tarefa-4', 'fazendo', clock.now());
    expect(await feita()).not.toHaveProperty('completedAt');
  });
});

describe('prazo, etiquetas e atividade', () => {
  test('textos e valores do prazo', () => {
    expect([HOJE, '2026-11-22', '2026-11-18'].map((d) => textoDoPrazo(d, HOJE))).toEqual(['hoje', 'esta semana', '18/11']);
    expect(prazoDaLista('2026-11-22', HOJE).valor).toBe('semana');
    expect(prazoDaLista('2026-12-01', HOJE).opcoes.at(-1)).toEqual({ valor: 'data', rotulo: '01/12' });
    expect(['hoje', 'semana', 'data', ''].map((v) => prazoEscolhido(v, '2026-12-01', HOJE))).toEqual([HOJE, '2026-11-22', '2026-12-01', undefined]);
  });

  test('etiquetas fixas e das metas ativas, cabendo no limite e sem repetir', () => {
    const meta: Goal = { id: 'm', title: 'Uma meta com um nome bem comprido demais', icon: '🎓', state: 'ativa', milestones: [], createdAt: 0 };
    const livres = etiquetasLivres(['Saúde'], [meta, { ...meta, id: 'n', title: 'Feita', state: 'concluida' }], '🎯');
    expect(livres.slice(0, 3)).toEqual(['Faculdade', 'Pessoal', 'Rotina']);
    expect(livres).toHaveLength(4);
    expect(livres[3]?.length).toBeLessThanOrEqual(TASKS.tagMaxChars);
    expect(etiquetasLivres(Array.from({ length: TASKS.maxTags }, (_, i) => `${i}`), [], '🎯')).toEqual([]);
  });

  test('frases e tempos', () => {
    const agora = Date.parse('2026-11-21T14:00:00-03:00');
    expect([0, 5, 120, 24 * 60, 72 * 60].map((m) => haQuanto(agora - m * 60_000, agora, FUSO))).toEqual(['agora', 'há 5 min', 'há 2 h', 'ontem', 'há 3 dias']);
    const evento = { id: 'e', taskId: 't', createdAt: agora };
    expect(textoDoEvento({ ...evento, kind: 'status', para: 'afazer' }, FUSO)).toBe('moveu para A fazer');
    expect(textoDoEvento({ ...evento, kind: 'prioridade', para: 'alta' }, FUSO)).toBe('marcou prioridade alta');
    expect(textoDoEvento({ ...evento, kind: 'prazo', para: HOJE }, FUSO)).toBe('definiu o prazo para hoje');
    expect(textoDoEvento({ ...evento, kind: 'prazo', de: HOJE }, FUSO)).toBe('removeu o prazo');
  });
});

describe('escritas', () => {
  test('apagar um campo opcional tira a chave; tarefa excluída não volta', async () => {
    const completa = tarefa('a', { description: 'x', dueDate: HOJE, goalId: 'm' });
    expect(comMudanca(completa, { description: '', dueDate: undefined, goalId: undefined })).toEqual(tarefa('a'));
    const { repo } = await criarContaDeExemplo();
    await repo.deleteTask('ex-tarefa-1');
    await alterarTarefa(repo, 'ex-tarefa-1', { title: 'volta?' });
    expect((await repo.listTasks()).some((t) => t.id === 'ex-tarefa-1')).toBe(false);
  });

  test('o repositório com avisos repassa os pomodoros do servidor', async () => {
    const { repo } = await criarContaDeExemplo();
    const remoto = { ...repo, getPomodoros: async () => ({ t: 7 }) };
    const envolvido = comAvisosDeErro(remoto, { avisar: () => undefined, sessaoExpirou: () => undefined });
    await expect(verPomodoros(envolvido)).resolves.toEqual({ t: 7 });
  });
});
