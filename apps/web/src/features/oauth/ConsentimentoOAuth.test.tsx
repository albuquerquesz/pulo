import { act, fireEvent, render, screen } from '@testing-library/react';

import { ConsentimentoOAuth } from './ConsentimentoOAuth';

const oauth2 = vi.hoisted(() => ({ publicClient: vi.fn(), consent: vi.fn() }));
vi.mock('./cliente', () => ({ clienteOAuth: () => ({ oauth2 }), escoposLegiveis: () => [] }));

const botao = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });

describe('ConsentimentoOAuth', () => {
  test('avisa que dá para apagar tudo; sem rede, volta a deixar tentar e mantém o nome', async () => {
    window.history.pushState({}, '', '/oauth/consentimento?client_id=abc');
    oauth2.publicClient.mockResolvedValue({ data: { client_name: 'Claude' } });
    oauth2.consent.mockRejectedValue(new TypeError('Failed to fetch'));
    await act(async () => void render(<ConsentimentoOAuth />));
    expect(screen.getByRole('note').textContent).toContain('apagar todos os seus dados');
    await act(async () => void fireEvent.click(botao('Agora não')));
    expect(screen.getByRole('alert').textContent).toBe('Não foi possível falar com o Pulo. Confira sua conexão e tente de novo.');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Claude quer usar o seu Pulo');
    expect(botao('Liberar').disabled).toBe(false);
  });

  test('só o botão escolhido fica carregando', async () => {
    oauth2.publicClient.mockRejectedValue(new TypeError('Failed to fetch'));
    oauth2.consent.mockReturnValue(new Promise(() => undefined));
    await act(async () => void render(<ConsentimentoOAuth />));
    await act(async () => void fireEvent.click(botao('Agora não')));
    expect(botao('Agora não').getAttribute('aria-busy')).toBe('true');
    expect(botao('Liberar').getAttribute('aria-busy')).toBe('false');
  });
});
