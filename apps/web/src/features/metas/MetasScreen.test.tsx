import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { JOIAS } from '@pulo/core/config/decisions';
import { verCasa } from '@pulo/core/domain/casa';
import { concluirMeta } from '@pulo/core/domain/goals';
import type { EntityId, Repository } from '@pulo/core/domain/types';

import { AppProvider, useApp } from '../app';
import { criarSessaoDemo } from '../app/demo';
import { MetasScreen, TEXTO_DO_LIMITE } from './MetasScreen';

function Pagina({ meta }: { meta?: EntityId }) {
  const { fase, aviso } = useApp();
  if (fase !== 'pronto') return null;
  return (
    <>
      <MetasScreen metaAberta={meta} />
      {aviso ? <output>{aviso.mensagem}</output> : null}
    </>
  );
}

async function abrir(meta?: EntityId, antes?: (repo: Repository) => Promise<unknown>) {
  const { repo, clock } = await criarSessaoDemo();
  await antes?.(repo);
  render(
    <AppProvider repoInicial={repo} relogioInicial={clock}>
      <Pagina meta={meta} />
    </AppProvider>,
  );
  await screen.findByRole('region', { name: 'Detalhe da meta' });
  return repo;
}

const detalhe = () => within(screen.getByRole('region', { name: 'Detalhe da meta' }));
const grupo = (nome: string) => within(screen.getByRole('region', { name: nome }));
const clicar = async (elemento: HTMLElement) => {
  await act(async () => {
    fireEvent.click(elemento);
  });
};
const meta = async (repo: Repository, id: string) => (await repo.listGoals()).find((g) => g.id === id);

afterEach(() => vi.restoreAllMocks());

describe('Tela de Metas', () => {
  test('lista em dois grupos e o detalhe com ritmo, números e hábitos', async () => {
    await abrir();
    expect(grupo('Em andamento').getAllByRole('button')).toHaveLength(2);
    expect(grupo('Concluídas').getByRole('button', { name: /Correr 5 km/ })).toBeTruthy();
    await clicar(screen.getByRole('button', { name: /Ler 4 livros/ }));
    expect(detalhe().getByRole('heading', { name: 'Ler 4 livros no semestre' })).toBeTruthy();
    expect(detalhe().getByText('“Voltar a ler por prazer, não só pra faculdade.”')).toBeTruthy();
    expect(detalhe().getByText('Um pouco atrás')).toBeTruthy();
    expect(detalhe().getByTestId('linha-de-ritmo').style.left).toBe('50%');
    expect(detalhe().getByText('Dias restantes').parentElement?.textContent).toContain('90');
    expect(detalhe().getByText('1 de 4')).toBeTruthy();
    await waitFor(() => expect(grupo('Hábitos atrelados').getByText('Ler 10 páginas')).toBeTruthy());
  });

  test('abre a meta pedida pela busca', async () => {
    await abrir('demo-meta-corrida');
    expect(detalhe().getByRole('heading', { name: 'Correr 5 km sem parar' })).toBeTruthy();
    expect(detalhe().getByText('Concluída')).toBeTruthy();
    expect(detalhe().queryByTestId('linha-de-ritmo')).toBeNull();
    expect(detalhe().getByRole('img', { name: 'Baú aberto' })).toBeTruthy();
  });

  test('riscar e adicionar marcos', async () => {
    const repo = await abrir('demo-meta-ingles');
    await clicar(detalhe().getByRole('checkbox', { name: 'Unidade 4' }));
    await waitFor(async () => expect((await meta(repo, 'demo-meta-ingles'))?.milestones[3].doneAt).toBeDefined());
    await clicar(detalhe().getByRole('button', { name: 'Adicionar marco' }));
    fireEvent.change(detalhe().getByRole('textbox', { name: 'Nome do novo marco' }), { target: { value: 'Certificado' } });
    await clicar(detalhe().getByRole('button', { name: 'Adicionar' }));
    expect(await detalhe().findByRole('checkbox', { name: 'Certificado' })).toBeTruthy();
  });

  test('atrelar um hábito tira ele da lista de opções', async () => {
    const repo = await abrir('demo-meta-ingles');
    await clicar(detalhe().getByRole('button', { name: '+ Atrelar hábito' }));
    const opcoes = () => within(screen.getByRole('list', { name: 'Hábitos sem meta' }));
    await clicar(opcoes().getByRole('button', { name: 'Atrelar Beber água' }));
    await waitFor(() => expect(opcoes().queryByRole('button', { name: 'Atrelar Beber água' })).toBeNull());
    expect(grupo('Hábitos atrelados').getByText('Beber água')).toBeTruthy();
    expect((await repo.listHabits()).find((h) => h.id === 'demo-habito-agua')?.goalId).toBe('demo-meta-ingles');
  });

  test('criar um hábito para a meta', async () => {
    // O demo já está no limite de hábitos por dia: abre espaço antes.
    const repo = await abrir('demo-meta-ingles', (r) => r.deleteHabit('demo-habito-agua'));
    await clicar(detalhe().getByRole('button', { name: '+ Atrelar hábito' }));
    await clicar(screen.getByRole('button', { name: '+ Criar hábito pra essa meta' }));
    const form = within(screen.getByRole('dialog', { name: 'Novo hábito' }));
    fireEvent.change(form.getByLabelText('Nome'), { target: { value: 'Ver um filme sem legenda' } });
    await clicar(form.getByRole('button', { name: 'Salvar' }));
    await waitFor(async () =>
      expect((await repo.listHabits()).find((h) => h.title === 'Ver um filme sem legenda')?.goalId).toBe('demo-meta-ingles'),
    );
  });

  test('abrir o baú grava uma vez só e soma as joias no saldo', async () => {
    let saldo = 0;
    const repo = await abrir('demo-meta-ingles', async (r) => {
      await concluirMeta(r, 'demo-meta-ingles', 1);
      saldo = (await verCasa(r)).saldo;
    });
    const gravar = vi.spyOn(repo, 'saveGoalChest');
    const botao = detalhe().getByRole('button', { name: `Abrir o baú e ganhar ${JOIAS.por.goalCompleted} joias` });
    await act(async () => {
      fireEvent.click(botao);
      fireEvent.click(botao);
    });
    await waitFor(() => expect(detalhe().getByRole('img', { name: 'Baú aberto' })).toBeTruthy());
    expect(gravar).toHaveBeenCalledTimes(1);
    expect((await verCasa(repo)).saldo).toBe(saldo + JOIAS.por.goalCompleted);
    expect(screen.getByTestId('joias-voando')).toBeTruthy();
  });

  test('nova meta com ícone e cor, e o limite de ativas', async () => {
    const repo = await abrir();
    await clicar(screen.getByRole('button', { name: '+ Nova meta' }));
    const form = within(screen.getByRole('dialog', { name: 'Nova meta' }));
    fireEvent.change(form.getByLabelText('Qual é a meta?'), { target: { value: 'Juntar uma reserva' } });
    fireEvent.change(form.getByLabelText('Ícone'), { target: { value: '💰' } });
    await clicar(form.getByRole('button', { name: 'Cor sol' }));
    await clicar(form.getByRole('button', { name: 'Criar meta' }));
    expect(await detalhe().findByRole('heading', { name: 'Juntar uma reserva' })).toBeTruthy();
    expect((await repo.listGoals()).find((g) => g.title === 'Juntar uma reserva')).toMatchObject({ icon: '💰', color: 'sol' });
    await clicar(screen.getByRole('button', { name: '+ Nova meta' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(TEXTO_DO_LIMITE)).toBeTruthy();
  });

  test('concluir pede confirmação e deixa o baú esperando', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const repo = await abrir('demo-meta-livros');
    await clicar(detalhe().getByRole('button', { name: 'Concluir meta' }));
    expect(await detalhe().findByRole('button', { name: 'Abrir o baú' })).toBeTruthy();
    expect((await meta(repo, 'demo-meta-livros'))?.state).toBe('concluida');
    await clicar(detalhe().getByRole('button', { name: 'Reabrir meta' }));
    await waitFor(async () => expect((await meta(repo, 'demo-meta-livros'))?.state).toBe('ativa'));
  });

  test('editar remove marco, e apagar tira a meta', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const repo = await abrir('demo-meta-livros');
    await clicar(detalhe().getByRole('button', { name: 'Editar' }));
    const form = within(screen.getByRole('dialog', { name: 'Editar meta' }));
    await clicar(form.getByRole('button', { name: 'Remover o marco Livro 4' }));
    await waitFor(async () => expect((await meta(repo, 'demo-meta-livros'))?.milestones).toHaveLength(3));
    await clicar(screen.getByRole('button', { name: 'Cancelar' }));
    await clicar(detalhe().getByRole('button', { name: 'Apagar' }));
    await waitFor(async () => expect(await meta(repo, 'demo-meta-livros')).toBeUndefined());
  });
});
