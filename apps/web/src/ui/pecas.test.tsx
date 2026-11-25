import { fireEvent, render, screen } from '@testing-library/react';

import { Barra, BarraValor, BotaoCanto, Modal, Nuvens, Placa } from './index';

describe('peças do rascunho', () => {
  test('a barra informa o progresso', () => {
    render(<Barra rotulo="Meta" feito={1} total={4} texto="1 / 4" />);
    expect(screen.getByRole('progressbar', { name: 'Meta' }).getAttribute('aria-valuenow')).toBe('1');
  });

  test('barra de valor, botão de canto e placa respondem ao toque', () => {
    const mais = vi.fn();
    const canto = vi.fn();
    const focar = vi.fn();
    render(
      <>
        <BarraValor icone={null} valor={140} rotulo="joias" onMais={mais} />
        <BotaoCanto icone="🏠" rotulo="Entrar em casa" onPress={canto} />
        <Placa titulo="Focar!" onPress={focar} />
      </>,
    );
    for (const name of ['Ganhar mais', 'Entrar em casa', 'Focar!']) fireEvent.click(screen.getByRole('button', { name }));
    expect([mais, canto, focar].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  });

  test('o modal fecha com Esc e com o fundo', () => {
    const fechar = vi.fn();
    const { rerender } = render(
      <Modal aberto rotulo="Decorar" onFechar={fechar}>
        conteúdo
      </Modal>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('fundo-do-modal'));
    expect(fechar).toHaveBeenCalledTimes(2);
    rerender(
      <Modal aberto={false} rotulo="Decorar" onFechar={fechar}>
        conteúdo
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('as nuvens não repetem o id do desenho entre cenas', () => {
    const { container } = render(
      <>
        <Nuvens />
        <Nuvens />
      </>,
    );
    const ids = [...container.querySelectorAll('symbol')].map((s) => s.id);
    expect(new Set(ids).size).toBe(2);
  });
});
