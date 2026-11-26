import { render, screen } from '@testing-library/react';

import type { FaseDoApp } from '../app';
import { TEXTO_SEM_SINAL, WelcomeScreen } from './WelcomeScreen';

const app = vi.hoisted(() => ({ fase: '', loginDisponivel: true, entrando: false, erroDeLogin: null }));
vi.mock('../app/AppProvider', () => ({ useApp: () => app }));

const comFase = (fase: FaseDoApp) => {
  app.fase = fase;
  render(<WelcomeScreen />);
};

describe('WelcomeScreen', () => {
  test('sem sinal: o sapo, o texto e só tentar de novo', () => {
    comFase('sem_conexao');
    expect(screen.getByRole('img', { name: 'Sapo, sem sinal' })).toBeTruthy();
    expect(screen.getByText(TEXTO_SEM_SINAL)).toBeTruthy();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Tentar de novo']);
  });

  test('boas vindas: o sapo acena e a única entrada é pela conta', () => {
    comFase('login');
    expect(screen.getByRole('img', { name: 'Sapo, acenando' })).toBeTruthy();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Entrar com Google']);
  });
});
