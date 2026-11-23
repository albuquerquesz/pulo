import { Navigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { Tela, useApp } from '@/features/app';
import { Texto } from '@/ui';

import { authClient } from './client';

type ExigeContaProps = { children: ReactNode };

/** Só mostra o app com a conta Google logada. Sem sessão, manda para a welcome. O modo demo passa direto. */
export function ExigeConta({ children }: ExigeContaProps) {
  const { demo } = useApp();
  const { data, isPending } = authClient.useSession();
  if (demo) return children;
  if (isPending) {
    return (
      <Tela semBarra>
        <Texto cor="muted" className="pt-10 text-center">
          Conferindo sua conta...
        </Texto>
      </Tela>
    );
  }
  if (!data) return <Navigate to="/welcome" replace />;
  return children;
}
