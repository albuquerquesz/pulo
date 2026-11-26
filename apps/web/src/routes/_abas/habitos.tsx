import { createFileRoute } from '@tanstack/react-router';

import { HabitosScreen } from '@/features/habitos/HabitosScreen';
import { lerBuscaDeHabitos } from '@/features/habitos/logic';

export const Route = createFileRoute('/_abas/habitos')({ validateSearch: lerBuscaDeHabitos, component: Habitos });

function Habitos() {
  const { habito } = Route.useSearch();
  const navegar = Route.useNavigate();
  return (
    <HabitosScreen
      aberto={habito}
      onAbrir={(id) => void navegar({ search: id ? { habito: id } : {} })}
      onVerMeta={(meta) => void navegar({ to: '/metas', search: { meta } })}
    />
  );
}
