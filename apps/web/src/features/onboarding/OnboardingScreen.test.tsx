import { act, fireEvent, render, screen } from '@testing-library/react';

import type * as App from '../app';
import { OnboardingScreen } from './OnboardingScreen';

const navigate = vi.fn();
const concluirOnboarding = vi.fn();
const sair = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate, Link: () => null }));
vi.mock('../app', async (original) => ({
  ...(await original<typeof App>()),
  useApp: () => ({ concluirOnboarding, sair, pessoa: { id: '1', nome: 'Ana Souza', email: 'ana@exemplo.test' } }),
}));

const botao = (name: string | RegExp) => screen.getByRole<HTMLButtonElement>('button', { name });
const clicar = (name: string | RegExp) => act(async () => void fireEvent.click(botao(name)));
const fala = () => screen.getByRole('heading', { level: 1 }).textContent;
const passoAtual = () => screen.getByRole('progressbar', { name: 'Passos' }).getAttribute('aria-valuenow');
const campo = (name: string) => screen.getByRole<HTMLInputElement>('textbox', { name });

describe('OnboardingScreen', () => {
  beforeEach(() => {
    navigate.mockReset();
    concluirOnboarding.mockReset();
    sair.mockReset();
  });

  test('dá para sair e voltar ao login sem terminar', async () => {
    render(<OnboardingScreen />);
    await clicar('Voltar ao login');
    expect(sair).toHaveBeenCalledTimes(1);
    expect(concluirOnboarding).not.toHaveBeenCalled();
  });

  test('começa com o nome da conta e sem as setas', () => {
    render(<OnboardingScreen />);
    expect(campo('Seu nome').value).toBe('Ana');
    expect(campo('Sobrenome').value).toBe('Souza');
    expect(botao('Voltar').disabled).toBe(true);
    expect(botao('Pular este passo').disabled).toBe(true);
  });

  test('sem nome ou sem sobrenome não dá para seguir', () => {
    render(<OnboardingScreen />);
    fireEvent.change(campo('Sobrenome'), { target: { value: '  ' } });
    expect(botao('Continuar').disabled).toBe(true);
    fireEvent.change(campo('Sobrenome'), { target: { value: 'Souza' } });
    fireEvent.change(campo('Seu nome'), { target: { value: '' } });
    expect(botao('Continuar').disabled).toBe(true);
  });

  test('avança, comenta a resposta, volta guardando o que foi respondido e pula', async () => {
    render(<OnboardingScreen />);
    fireEvent.change(campo('Seu nome'), { target: { value: 'Bia' } });
    await clicar('Continuar');
    expect(fala()).toBe('Prazer, Bia! Quantos anos você tem?');
    expect(botao('Pular este passo').disabled).toBe(true);
    expect(botao('Continuar').disabled).toBe(true);
    await clicar('Um ano a menos');
    expect(fala()).toBe('Fase de muita novidade, né?');
    await clicar('Continuar');
    expect(fala()).toBe('Como anda a sua vida hoje?');
    expect(botao('Continuar').disabled).toBe(true);
    await clicar('Estudando');
    expect(fala()).toBe('Bora fazer os estudos renderem!');
    await clicar('Continuar');
    expect(passoAtual()).toBe('4');
    await clicar(/Distração/);
    expect(fala()).toBe('Te ajudo a silenciar o mundo durante o foco.');
    await clicar('Voltar');
    expect(passoAtual()).toBe('3');
    expect(botao('Estudando').getAttribute('aria-pressed')).toBe('true');
    await clicar('Continuar');
    expect(botao(/Distração/).getAttribute('aria-pressed')).toBe('true');
    await clicar('Pular este passo');
    expect(passoAtual()).toBe('5');
  });

  test('o último passo já entra na lagoa: salva uma vez e vai para o Hoje', async () => {
    render(<OnboardingScreen />);
    await clicar('Continuar');
    fireEvent.change(screen.getByRole('slider', { name: 'Sua idade' }), { target: { value: '31' } });
    expect(fala()).toBe('Idade de malabarista: dá conta de tudo.');
    await clicar('Continuar');
    await clicar('Trabalhando');
    await clicar('Continuar');
    await clicar(/Começar/);
    await clicar(/Distração/);
    await clicar('Continuar');
    await clicar('Alongar');
    await clicar('Caminhar');
    await clicar('Estudar');
    expect(botao('Beber água').disabled).toBe(true);
    expect(fala()).toBe('3 folhas na lagoa!');
    expect(concluirOnboarding).not.toHaveBeenCalled();
    await clicar('Pular na lagoa');
    expect(concluirOnboarding).toHaveBeenCalledTimes(1);
    expect(concluirOnboarding).toHaveBeenCalledWith({ frogName: 'Pulo', startHour: 7, endHour: 22 });
    expect(navigate).toHaveBeenCalledWith({ to: '/', replace: true });
  });

  test('se salvar falhar, fica no último passo e deixa tentar de novo', async () => {
    concluirOnboarding.mockRejectedValueOnce(new Error('sem sinal'));
    render(<OnboardingScreen />);
    await clicar('Continuar');
    await clicar('Um ano a mais');
    await clicar('Continuar');
    await clicar('Em transição');
    await clicar('Continuar');
    await clicar('Pular este passo');
    await clicar('Pular este passo');
    expect(navigate).not.toHaveBeenCalled();
    expect(passoAtual()).toBe('5');
    await clicar('Pular este passo');
    expect(concluirOnboarding).toHaveBeenLastCalledWith({ frogName: 'Pulo', startHour: 7, endHour: 22 });
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
