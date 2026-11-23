import { render, screen } from '@testing-library/react';

import type { FrogMood, Phase } from '@pulo/core/domain/types';
import { TemaProvider } from '@/theme';

import { Lagoa, Sapo, rotuloDoSapo } from './index';

const FASES: Phase[] = [1, 2, 3, 4];
const HUMORES: FrogMood[] = ['feliz', 'pensando', 'pouso'];

describe('Sapo', () => {
  it.each(FASES)('desenha a fase %i', (fase) => {
    render(<Sapo fase={fase} />);
    const sapo = screen.getByTestId('sapo');
    expect(sapo.querySelector('svg')).not.toBeNull();
    expect(sapo.getAttribute('role')).toBe('img');
    expect(sapo.getAttribute('aria-label')).toBe(rotuloDoSapo('parado'));
  });

  it.each(HUMORES)('mostra o humor %s na fase 4', (estado) => {
    render(<Sapo fase={4} estado={estado} />);
    expect(screen.getByRole('img', { name: rotuloDoSapo(estado) })).toBeDefined();
  });

  it('desenha qualquer humor desde a fase 1, sempre como sapo', () => {
    render(<Sapo fase={1} estado="pensando" />);
    expect(screen.getByTestId('sapo').getAttribute('aria-label')).toBe(rotuloDoSapo('pensando'));
  });

  it('troca de estado e pula com reduzir movimento, sem loops', () => {
    const arvore = (estado: FrogMood, salto: number) => (
      <TemaProvider raiz={false} reduzirMovimento>
        <Sapo fase={4} estado={estado} salto={salto} />
      </TemaProvider>
    );
    const { rerender } = render(arvore('parado', 0));
    rerender(arvore('pouso', 1));
    rerender(arvore('feliz', 2));
    const sapo = screen.getByTestId('sapo');
    expect(sapo.getAttribute('aria-label')).toBe(rotuloDoSapo('feliz'));
    expect(sapo.querySelector('.sapo-vivo')).toBeNull();
  });

  it('liga os loops sem reduzir movimento', () => {
    render(<Sapo fase={4} reducedMotion={false} />);
    expect(screen.getByTestId('sapo').querySelector('.sapo-vivo')).not.toBeNull();
  });
});

describe('Lagoa', () => {
  it('desenha o cenário com o sapo', () => {
    render(
      <TemaProvider raiz={false} reduzirMovimento>
        <Lagoa
          fase={3}
          resumo={{ careDays: 4, stable: true }}
          agora={{ diasDeCuidadoTotal: 30, dentroDoDia: false, descansoHoje: false }}
          estadoDoSapo="feliz"
        />
      </TemaProvider>,
    );
    const lagoa = screen.getByTestId('lagoa');
    expect(lagoa.getAttribute('aria-label')).toBe('Lagoa, fase 3, noite');
    expect(lagoa.querySelector('svg')).not.toBeNull();
    expect(screen.getByTestId('sapo').getAttribute('aria-label')).toBe(rotuloDoSapo('feliz'));
    expect(lagoa.querySelector('.lagoa-ativo')).toBeNull();
  });
});
