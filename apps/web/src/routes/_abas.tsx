import { Navigate, Outlet, createFileRoute, useLocation, useNavigate } from '@tanstack/react-router';

import { useApp } from '@/features/app';
import { BarraAbas } from '@/ui';

type Aba = { chave: string; rotulo: string; para: '/' | '/foco' | '/semana' | '/perfil' };

const ABAS: Aba[] = [
  { chave: 'hoje', rotulo: 'Hoje', para: '/' },
  { chave: 'foco', rotulo: 'Foco', para: '/foco' },
  { chave: 'rotina', rotulo: 'Semana', para: '/semana' },
  { chave: 'perfil', rotulo: 'Perfil', para: '/perfil' },
];

export const Route = createFileRoute('/_abas')({ component: LayoutDasAbas });

/** Abas do app. Sem conta (e sem demo) vai para a welcome; sem sapo criado ainda, para o onboarding. */
function LayoutDasAbas() {
  const { fase, user } = useApp();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  if (fase !== 'pronto') return <Navigate to="/welcome" replace />;
  if (!user) return <Navigate to="/onboarding" replace />;

  const ativa = ABAS.find((a) => a.para === pathname)?.chave ?? 'hoje';
  return (
    <div className="md:flex md:min-h-dvh">
      <BarraAbas
        abas={ABAS}
        ativa={ativa}
        onSelecionar={(chave) => {
          const aba = ABAS.find((a) => a.chave === chave);
          if (aba) void navigate({ to: aba.para });
        }}
        className="fixed inset-x-0 bottom-0 z-10 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:sticky md:top-0 md:h-dvh md:w-24"
      />
      <div className="md:flex-1">
        <Outlet />
      </div>
    </div>
  );
}
