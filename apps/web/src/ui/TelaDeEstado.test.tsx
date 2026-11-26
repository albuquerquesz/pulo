import { fireEvent, render, screen } from '@testing-library/react';

import { TemaProvider } from '@/theme';

import { TelaDeEstado } from './TelaDeEstado';

const tela = (acao = vi.fn()) => (
  <TemaProvider raiz={false} reduzirMovimento>
    <TelaDeEstado
      momento="erro"
      titulo="Algo tropeçou"
      texto="Tente de novo."
      acao={{ titulo: 'Tentar de novo', onPress: acao }}
      secundarias={[{ titulo: 'Sair', onPress: vi.fn() }]}
    />
  </TemaProvider>
);

describe('TelaDeEstado', () => {
  it('mostra o sapo com o humor do momento', () => {
    render(tela());
    expect(screen.getByRole('img', { name: 'Sapo, confuso' })).toBeDefined();
  });

  it('a ação principal vem antes das secundárias', () => {
    const acao = vi.fn();
    render(tela(acao));
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Tentar de novo', 'Sair']);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(acao).toHaveBeenCalledTimes(1);
  });
});
