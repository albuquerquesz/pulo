import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import { Escolha } from './Escolha';

const OPCOES = [
  { valor: 'a', rotulo: 'Manhã' },
  { valor: 'b', rotulo: 'Tarde' },
  { valor: 'c', rotulo: 'Noite' },
];

function Seletor({ aoEscolher }: { aoEscolher: (v: string) => void }) {
  const [valor, setValor] = useState('a');
  return (
    <Escolha
      rotulo="Período"
      valor={valor}
      opcoes={OPCOES}
      onEscolher={(v) => {
        setValor(v);
        aoEscolher(v);
      }}
    />
  );
}

describe('Escolha', () => {
  test('clique abre a lista com a opção marcada e escolher fecha', () => {
    const aoEscolher = vi.fn();
    render(<Seletor aoEscolher={aoEscolher} />);
    const botao = screen.getByRole('combobox', { name: 'Período' });
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(botao);
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('option', { name: 'Manhã' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('option', { name: 'Noite' }));
    expect(aoEscolher).toHaveBeenCalledWith('c');
    expect(botao.textContent).toBe('Noite');
    expect(botao.getAttribute('aria-expanded')).toBe('false');
  });

  test('teclado: seta abre e anda, Enter escolhe, Esc fecha sem mudar', () => {
    const aoEscolher = vi.fn();
    render(<Seletor aoEscolher={aoEscolher} />);
    const botao = screen.getByRole('combobox', { name: 'Período' });
    fireEvent.keyDown(botao, { key: 'ArrowDown' });
    fireEvent.keyDown(botao, { key: 'ArrowDown' });
    fireEvent.keyDown(botao, { key: 'Enter' });
    expect(aoEscolher).toHaveBeenCalledWith('b');
    fireEvent.keyDown(botao, { key: 'ArrowDown' });
    fireEvent.keyDown(botao, { key: 'End' });
    fireEvent.keyDown(botao, { key: 'Escape' });
    expect(aoEscolher).toHaveBeenCalledTimes(1);
    expect(botao.getAttribute('aria-expanded')).toBe('false');
  });
});
