import { act, fireEvent, render, screen } from '@testing-library/react';

import type * as App from '../app';
import { OnboardingScreen } from './OnboardingScreen';

const navigate = vi.fn();
const concluirOnboarding = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate, Link: () => null }));
vi.mock('../app', async (original) => ({
  ...(await original<typeof App>()),
  useApp: () => ({ concluirOnboarding, pessoa: { id: '1', nome: 'Ana Souza', email: 'ana@exemplo.test' } }),
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
  });

  test('começa com o nome da conta e sem as setas', () => {
    render(<OnboardingScreen />);
    expect(campo('Seu nome').value).toBe('Ana');
    expect(campo('Sobrenome').value).toBe('Souza');
    expect(botao('Voltar').disabled).toBe(true);
    expect(botao('Pular este passo').disabled).toBe(true);
  });

  test('avança, comenta a resposta, volta guardando o que foi respondido e pula', async () => {
    render(<OnboardingScreen />);
    fireEvent.change(campo('Seu nome'), { target: { value: 'Bia' } });
    await clicar('Continuar');
    expect(fala()).toBe('Prazer, Bia! Me conta do seu dia.');
    expect(botao('Continuar').disabled).toBe(true);
    await clicar('Noite');
    expect(fala()).toBe('Coruja da lagoa! Respeito.');
    expect(botao('Noite').getAttribute('aria-pressed')).toBe('true');
    await clicar('Continuar');
    expect(passoAtual()).toBe('3');
    await clicar('Voltar');
    expect(passoAtual()).toBe('2');
    expect(botao('Noite').getAttribute('aria-pressed')).toBe('true');
    await clicar('Continuar');
    await clicar('Pular este passo');
    expect(passoAtual()).toBe('4');
  });

  test('fluxo inteiro chama concluirOnboarding uma vez, só ao entrar na lagoa', async () => {
    render(<OnboardingScreen />);
    await clicar('Continuar');
    await clicar('Uma hora depois, Começa às');
    await clicar('Manhã');
    await clicar('Continuar');
    await clicar(/Começar/);
    await clicar(/Distração/);
    await clicar('Continuar');
    await clicar(/Com carinho/);
    expect(botao('Continuar').disabled).toBe(true);
    await clicar(/Clássico/);
    await clicar('Continuar');
    await clicar('Alongar');
    await clicar('Caminhar');
    await clicar('Estudar');
    expect(botao('Beber água').disabled).toBe(true);
    expect(fala()).toBe('3 folhas na lagoa!');
    await clicar('Continuar');
    await clicar('Girino');
    await clicar('Continuar');
    const chave = screen.getByRole('switch', { name: 'Deixar o Pulo aprender comigo' });
    expect(chave.getAttribute('aria-checked')).toBe('false');
    await act(async () => void fireEvent.click(chave));
    expect(chave.getAttribute('aria-checked')).toBe('true');
    await clicar('Pular na lagoa');
    expect(fala()).toBe('Bora, Ana!');
    expect(screen.getByText('Girino já está na lagoa, com 3 folhas para pular.')).toBeTruthy();
    expect(concluirOnboarding).not.toHaveBeenCalled();
    await clicar('Entrar na lagoa');
    expect(concluirOnboarding).toHaveBeenCalledTimes(1);
    expect(concluirOnboarding).toHaveBeenCalledWith({ frogName: 'Girino', startHour: 8, endHour: 22 });
    expect(navigate).toHaveBeenCalledWith({ to: '/', replace: true });
  });

  test('se salvar falhar, fica na despedida e deixa tentar de novo', async () => {
    concluirOnboarding.mockRejectedValueOnce(new Error('sem sinal'));
    render(<OnboardingScreen />);
    await clicar('Continuar');
    await clicar('Varia');
    await clicar('Continuar');
    for (let i = 0; i < 4; i += 1) await clicar('Pular este passo');
    await clicar('Pular na lagoa');
    await clicar('Entrar na lagoa');
    expect(navigate).not.toHaveBeenCalled();
    await clicar('Entrar na lagoa');
    expect(concluirOnboarding).toHaveBeenLastCalledWith({ frogName: 'Pulo', startHour: 7, endHour: 22 });
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
