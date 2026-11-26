import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router';

import { Redirecionar, useApp } from '@/features/app';
import { Casca } from '@/features/casca/Casca';

export const Route = createFileRoute('/_abas')({ component: LayoutDasAbas });

/** A casca do app. Sem conta vai para a welcome; sem sapo criado ainda, para o onboarding. */
function LayoutDasAbas() {
  const { fase, user } = useApp();
  const { pathname } = useLocation();
  if (fase !== 'pronto') return <Redirecionar para="/welcome" />;
  if (!user) return <Redirecionar para="/onboarding" />;

  return (
    <Casca caminho={pathname}>
      <Outlet />
    </Casca>
  );
}
