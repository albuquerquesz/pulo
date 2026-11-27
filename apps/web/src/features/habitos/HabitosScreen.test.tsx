import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';

import { MAX_HABITS_PER_DAY } from '@pulo/core/config/decisions';
import { habitsForDate } from '@pulo/core/domain/habits';
import type { EntityId, Repository } from '@pulo/core/domain/types';

import { AppProvider, useApp } from '../app';
import { criarContaDeExemplo } from '../../testing/conta-de-exemplo';
import { HabitosScreen } from './HabitosScreen';

const HOJE = '2026-11-21';
const verMeta = vi.fn();

function Pagina() {
  const { fase, aviso } = useApp();
  const [aberto, setAberto] = useState<EntityId | null>(null);
  if (fase !== 'pronto') return null;
  return (
    <>
      <HabitosScreen aberto={aberto ?? undefined} onAbrir={setAberto} onVerMeta={verMeta} />
      {aviso ? <output>{aviso.mensagem}</output> : null}
    </>
  );
}

async function abrir() {
  const { repo, clock } = await criarContaDeExemplo();
  render(
    <AppProvider repoInicial={repo} relogioInicial={clock}>
      <Pagina />
    </AppProvider>,
  );
  await screen.findByRole('region', { name: 'Detalhe do hábito' });
  return repo;
}

const detalhe = () => within(screen.getByRole('region', { name: 'Detalhe do hábito' }));
const grupo = (nome: string) => within(screen.getByRole('region', { name: nome }));
const habito = async (repo: Repository, id: string) => (await repo.listHabits()).find((h) => h.id === id);
const clicar = async (elemento: HTMLElement) => {
  await act(async () => {
    fireEvent.click(elemento);
  });
};
const escolher = (nome: RegExp) => clicar(screen.getByRole('button', { name: nome }));

beforeEach(() => verMeta.mockClear());
afterEach(() => vi.restoreAllMocks());

describe('Hábitos', () => {
  test('lista por período e o detalhe do hábito clicado', async () => {
    await abrir();
    expect(grupo('☀️ Manhã').getAllByRole('button')).toHaveLength(3);
    expect(grupo('🌙 Noite').getByRole('button', { name: /Ler 10 páginas/ })).toBeTruthy();
    await escolher(/^Estudar inglês/);
    expect(detalhe().getByRole('heading', { name: 'Estudar inglês' })).toBeTruthy();
    expect(detalhe().getByText('🔁 seg a sex')).toBeTruthy();
    expect(detalhe().getByText('⏰ 14h30')).toBeTruthy();
    await waitFor(() => expect(detalhe().getByText('Vezes feito').parentElement?.textContent).toMatch(/\d+/));
    const calendario = detalhe().getByRole('img', { name: 'Calendário das últimas 16 semanas' });
    expect(calendario.querySelectorAll('[data-estado]')).toHaveLength(16 * 7);
    expect(calendario.querySelector('[data-hoje]')?.getAttribute('data-date')).toBe(HOJE);
  });

  test('trocar a meta grava goalId, e Ver meta leva à aba Metas', async () => {
    const repo = await abrir();
    await escolher(/^Estudar inglês/);
    await clicar(detalhe().getByRole('button', { name: 'Ver meta' }));
    expect(verMeta).toHaveBeenCalledWith('ex-meta-ingles');
    await clicar(detalhe().getByRole('button', { name: 'Trocar meta' }));
    await clicar(detalhe().getByRole('radio', { name: /Ler 4 livros/ }));
    await waitFor(async () => expect((await habito(repo, 'ex-habito-ingles'))?.goalId).toBe('ex-meta-livros'));
    await clicar(await detalhe().findByRole('button', { name: 'Trocar meta' }));
    await clicar(detalhe().getByRole('radio', { name: 'Sem meta' }));
    await waitFor(async () => expect((await habito(repo, 'ex-habito-ingles'))?.goalId).toBeUndefined());
    expect(await detalhe().findByText('Esse hábito ainda não empurra nenhuma meta.')).toBeTruthy();
  });

  test('pausar tira o hábito do Hoje e dá para retomar', async () => {
    const repo = await abrir();
    await escolher(/^Ler 10 páginas/);
    await clicar(detalhe().getByRole('button', { name: 'Pausar hábito' }));
    const doDia = async () => habitsForDate(await repo.listHabits(), HOJE).map((h) => h.id);
    expect(await doDia()).not.toContain('ex-habito-ler');
    expect(await grupo('⏸️ Pausados').findByRole('button', { name: /Ler 10 páginas/ })).toBeTruthy();
    await clicar(detalhe().getByRole('button', { name: 'Retomar hábito' }));
    expect(await doDia()).toContain('ex-habito-ler');
  });

  test('a agenda grava dias, período e lembrete', async () => {
    const repo = await abrir();
    await escolher(/^Caminhar/);
    await clicar(detalhe().getByRole('button', { name: 'sábado' }));
    await clicar(detalhe().getByRole('combobox', { name: 'Período' }));
    await clicar(detalhe().getByRole('option', { name: /Tarde/ }));
    await clicar(detalhe().getByRole('switch', { name: 'Lembrete' }));
    const campo = detalhe().getByLabelText('Horário do lembrete');
    fireEvent.change(campo, { target: { value: '18:15' } });
    await act(async () => {
      fireEvent.blur(campo);
    });
    expect(await habito(repo, 'ex-habito-caminhar')).toMatchObject({
      weekdays: [0, 2, 4],
      period: 'tarde',
      reminderMinutes: 18 * 60 + 15,
      reminderOn: true,
    });
    await clicar(await detalhe().findByRole('switch', { name: 'Lembrete', checked: true }));
    const depois = await habito(repo, 'ex-habito-caminhar');
    expect(depois?.reminderOn).toBeUndefined();
    expect(depois?.reminderMinutes).toBe(18 * 60 + 15);
  });

  test('o limite por dia mostra a mensagem e não grava', async () => {
    const repo = await abrir();
    // Segunda já tem o máximo: um novo hábito de todo dia não cabe.
    expect(habitsForDate(await repo.listHabits(), '2026-11-23')).toHaveLength(MAX_HABITS_PER_DAY);
    await clicar(screen.getByRole('button', { name: '+ Novo hábito' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome' }), { target: { value: 'Meditar' } });
    await clicar(screen.getByRole('button', { name: 'Salvar' }));
    expect((await screen.findByRole('status')).textContent).toContain('Um dia comporta até');
    expect((await repo.listHabits()).some((h) => h.title === 'Meditar')).toBe(false);
    expect(screen.getByRole('dialog', { name: 'Novo hábito' })).toBeTruthy();
  });

  test('salvar sem nome avisa junto do campo e não grava', async () => {
    const repo = await abrir();
    const antes = (await repo.listHabits()).length;
    await clicar(screen.getByRole('button', { name: '+ Novo hábito' }));
    const dialogo = within(screen.getByRole('dialog', { name: 'Novo hábito' }));
    const campo = dialogo.getByRole('textbox', { name: 'Nome' });
    fireEvent.change(campo, { target: { value: '   ' } });
    await clicar(dialogo.getByRole('button', { name: 'Salvar' }));
    expect(dialogo.getByRole('alert').textContent).toBe('Dê um nome ao hábito.');
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(await repo.listHabits()).toHaveLength(antes);
    fireEvent.change(campo, { target: { value: 'Meditar' } });
    expect(dialogo.queryByRole('alert')).toBeNull();
  });

  test('cria um hábito e o abre; arquivar tira da lista', async () => {
    const repo = await abrir();
    await clicar(screen.getByRole('button', { name: '+ Novo hábito' }));
    const dialogo = within(screen.getByRole('dialog', { name: 'Novo hábito' }));
    fireEvent.change(dialogo.getByRole('textbox', { name: 'Nome' }), { target: { value: 'Meditar' } });
    for (const dia of ['segunda', 'terça', 'quarta', 'quinta', 'sexta']) await clicar(dialogo.getByRole('button', { name: dia }));
    await clicar(dialogo.getByRole('combobox', { name: 'Período' }));
    await clicar(dialogo.getByRole('option', { name: /Noite/ }));
    await clicar(dialogo.getByRole('button', { name: 'Salvar' }));
    expect(await detalhe().findByRole('heading', { name: 'Meditar' })).toBeTruthy();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await clicar(detalhe().getByRole('button', { name: 'Arquivar' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Meditar/ })).toBeNull());
    expect((await repo.listHabits()).find((h) => h.title === 'Meditar')?.state).toBe('arquivado');
  });
});
