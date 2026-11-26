import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import type { Repository } from '@pulo/core/domain/types';

import { AppProvider, useApp } from '../app';
import { criarContaDeExemplo } from '../../testing/conta-de-exemplo';
import { TarefasScreen } from './TarefasScreen';

const navegar = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navegar }));

const TITULO = 'Resumo do capítulo 3 de Bioquímica';

async function abrir() {
  const { repo, clock } = await criarContaDeExemplo();
  function Sonda() {
    return useApp().fase === 'pronto' ? <TarefasScreen /> : null;
  }
  render(
    <AppProvider repoInicial={repo} relogioInicial={clock}>
      <Sonda />
    </AppProvider>,
  );
  await screen.findByRole('article', { name: TITULO });
  return repo;
}

const coluna = (nome: string) => within(screen.getByRole('region', { name: nome }));
const cartao = (nome: string) => screen.getByRole('article', { name: nome });
const tarefa = async (repo: Repository, id: string) => (await repo.listTasks()).find((t) => t.id === id);

async function abrirGaveta(nome = TITULO) {
  await act(async () => {
    fireEvent.click(within(cartao(nome)).getByText(nome));
  });
  return within(screen.getByRole('dialog', { name: 'Detalhe da tarefa' }));
}

const teclar = async (campo: HTMLElement, key: string) => {
  await act(async () => {
    fireEvent.keyDown(campo, { key });
  });
};

beforeEach(() => navegar.mockClear());
afterEach(() => vi.restoreAllMocks());

describe('Tarefas', () => {
  test('quadro com contagens, filtro por prazo e subtarefas no cartão', async () => {
    const repo = await abrir();
    expect(coluna('A fazer').getAllByRole('article')).toHaveLength(3);
    expect(within(cartao(TITULO)).getByText('1/3 🍅')).toBeTruthy();
    expect(within(cartao('Marcar dentista')).queryByText('Subtarefas')).toBeNull();
    await act(async () => {
      fireEvent.click(within(cartao(TITULO)).getByRole('checkbox', { name: 'Mapa mental' }));
    });
    expect((await repo.listSubtasks()).find((s) => s.title === 'Mapa mental')?.done).toBe(true);
    expect(await within(cartao(TITULO)).findByText('3/5')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(coluna('A fazer').getAllByRole('article')).toHaveLength(2);
    expect(coluna('Ideias').queryAllByRole('article')).toHaveLength(0);
  });

  test('arrastar muda o status no repositório, e Feito risca o cartão', async () => {
    const repo = await abrir();
    await act(async () => {
      fireEvent.dragStart(cartao('Marcar dentista'));
    });
    await act(async () => {
      fireEvent.dragOver(screen.getByRole('region', { name: 'Feito' }));
      fireEvent.drop(screen.getByRole('region', { name: 'Feito' }));
    });
    expect(await tarefa(repo, 'ex-tarefa-4')).toMatchObject({ status: 'feito', completedAt: expect.any(Number) });
    await waitFor(() => expect(coluna('Feito').getAllByRole('article')).toHaveLength(3));
    expect(within(cartao('Marcar dentista')).getByText('Marcar dentista').className).toContain('line-through');
  });

  test('Adicionar abre um campo na coluna: Enter cria e Esc cancela', async () => {
    const repo = await abrir();
    const abrirCampo = (botao: string) => {
      fireEvent.click(coluna('Ideias').getByRole('button', { name: botao }));
      return coluna('Ideias').getByRole('textbox', { name: 'Nova tarefa em Ideias' });
    };
    let campo = abrirCampo('+ Adicionar');
    fireEvent.change(campo, { target: { value: '  Comprar caderno  ' } });
    await teclar(campo, 'Enter');
    await waitFor(() => expect(coluna('Ideias').getAllByRole('article').at(-1)?.getAttribute('aria-label')).toBe('Comprar caderno'));
    expect((await repo.listTasks()).find((t) => t.title === 'Comprar caderno')?.status).toBe('ideias');
    await teclar(campo, 'Escape');
    expect(coluna('Ideias').queryByRole('textbox')).toBeNull();

    const antes = (await repo.listTasks()).length;
    campo = abrirCampo('Adicionar tarefa em Ideias');
    await teclar(campo, 'Enter');
    fireEvent.change(campo, { target: { value: 'Desistir' } });
    await teclar(campo, 'Escape');
    expect(coluna('Ideias').queryByRole('textbox')).toBeNull();
    expect(await repo.listTasks()).toHaveLength(antes);
  });

  test('+ subtarefa no cartão abre o campo e grava com Enter', async () => {
    const repo = await abrir();
    fireEvent.click(within(cartao(TITULO)).getByRole('button', { name: '+ subtarefa' }));
    const campo = within(cartao(TITULO)).getByRole('textbox', { name: 'Nova subtarefa' });
    fireEvent.change(campo, { target: { value: 'Revisar' } });
    await teclar(campo, 'Enter');
    await waitFor(() => expect(within(cartao(TITULO)).getByRole('checkbox', { name: 'Revisar' })).toBeTruthy());
    expect((await repo.listSubtasks()).find((s) => s.title === 'Revisar')?.taskId).toBe('ex-tarefa-1');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('a gaveta carrega a atividade, comenta com Enter e fecha com Esc', async () => {
    const repo = await abrir();
    const gaveta = await abrirGaveta();
    expect(await gaveta.findByText(/moveu para Fazendo · ontem/)).toBeTruthy();
    expect(gaveta.getByText(/criou a tarefa · há 3 dias/)).toBeTruthy();
    const campo = gaveta.getByRole('textbox', { name: 'Comentário' });
    fireEvent.change(campo, { target: { value: 'Falta o fichamento' } });
    await teclar(campo, 'Enter');
    expect(await gaveta.findByText('Falta o fichamento')).toBeTruthy();
    expect((await repo.listTaskActivity('ex-tarefa-1')).comments).toHaveLength(1);
    await teclar(window.document.body, 'Escape');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('subtarefa com Enter, e Esc no campo não fecha a gaveta', async () => {
    const repo = await abrir();
    const gaveta = await abrirGaveta('Marcar dentista');
    fireEvent.click(gaveta.getByRole('button', { name: '+ Adicionar subtarefas' }));
    const campo = gaveta.getByRole('textbox', { name: 'Nova subtarefa' });
    fireEvent.change(campo, { target: { value: 'Ligar na clínica' } });
    await teclar(campo, 'Enter');
    expect((await repo.listSubtasks()).filter((s) => s.taskId === 'ex-tarefa-4').map((s) => s.title)).toEqual(['Ligar na clínica']);
    expect(await gaveta.findByRole('button', { name: 'Remover Ligar na clínica' })).toBeTruthy();
    await teclar(campo, 'Escape');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  test('propriedades e título gravam; fechar guarda o que estava sendo digitado', async () => {
    const repo = await abrir();
    const gaveta = await abrirGaveta('Marcar dentista');
    const escolher = async (nome: string, valor: string) => {
      await act(async () => {
        fireEvent.change(gaveta.getByRole('combobox', { name: nome }), { target: { value: valor } });
      });
    };
    await escolher('Prioridade', 'alta');
    await escolher('Pomodoros', '2');
    await escolher('Etiquetas', 'Saúde');
    await escolher('Meta', 'ex-meta-livros');
    await escolher('Prazo', '');
    const titulo = gaveta.getByRole('textbox', { name: 'Título da tarefa' });
    titulo.focus();
    titulo.textContent = 'Marcar dentista na terça';
    fireEvent.input(titulo);
    await act(async () => {
      fireEvent.click(screen.getByTestId('fundo-da-gaveta'));
    });
    const salva = await tarefa(repo, 'ex-tarefa-4');
    expect(salva).toMatchObject({
      title: 'Marcar dentista na terça',
      priority: 'alta',
      pomodorosEstimated: 2,
      tags: ['Pessoal', 'Saúde'],
      goalId: 'ex-meta-livros',
    });
    expect(salva).not.toHaveProperty('dueDate');
  });

  test('focar leva para a Casa com a tarefa, e excluir pede confirmação', async () => {
    const repo = await abrir();
    let gaveta = await abrirGaveta();
    fireEvent.click(gaveta.getByRole('button', { name: 'Focar nessa tarefa' }));
    expect(navegar).toHaveBeenCalledWith({ to: '/casa', search: { tarefa: 'ex-tarefa-1' } });
    gaveta = await abrirGaveta();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await act(async () => {
      fireEvent.click(gaveta.getByRole('button', { name: 'Excluir' }));
    });
    expect(confirm).toHaveBeenCalledWith(`Excluir esta tarefa?\n"${TITULO}" e as subtarefas dela somem. Não dá para desfazer.`);
    expect(await tarefa(repo, 'ex-tarefa-1')).toBeDefined();
    expect(screen.getByRole('dialog')).toBeTruthy();
    confirm.mockReturnValue(true);
    await act(async () => {
      fireEvent.click(gaveta.getByRole('button', { name: 'Excluir' }));
    });
    expect(await tarefa(repo, 'ex-tarefa-1')).toBeUndefined();
    await waitFor(() => expect(screen.queryByRole('article', { name: TITULO })).toBeNull());
  });
});
