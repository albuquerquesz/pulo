import { render } from '@testing-library/react';

import { Redirecionar } from './Redirecionar';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));

describe('Redirecionar', () => {
  beforeEach(() => navigate.mockReset());

  test('navega uma vez só, mesmo com o pai renderizando de novo', () => {
    const { rerender } = render(<Redirecionar para="/onboarding" />);
    for (let i = 0; i < 5; i += 1) rerender(<Redirecionar para="/onboarding" />);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({ to: '/onboarding', replace: true });
  });

  test('um destino novo navega de novo', () => {
    const { rerender } = render(<Redirecionar para="/onboarding" />);
    rerender(<Redirecionar para="/welcome" />);
    expect(navigate).toHaveBeenCalledTimes(2);
  });
});
