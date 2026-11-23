import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

type Destino = '/' | '/welcome' | '/onboarding';
type RedirecionarProps = { para: Destino };

/**
 * Redireciona UMA vez. O `<Navigate>` do TanStack Router navega de novo sempre que as props mudam, e elas são um
 * objeto novo a cada render: num layout que ouve a URL isso vira um laço de navegações que trava a página.
 */
export function Redirecionar({ para }: RedirecionarProps) {
  const navigate = useNavigate();
  const feito = useRef<Destino | null>(null);
  useEffect(() => {
    if (feito.current === para) return;
    feito.current = para;
    void navigate({ to: para, replace: true });
  }, [navigate, para]);
  return null;
}
