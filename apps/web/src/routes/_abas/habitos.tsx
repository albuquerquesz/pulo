import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';

import { HabitosScreen } from '@/features/habitos/HabitosScreen';
import { lerBuscaDeHabitos } from '@/features/habitos/logic';

export const Route = createFileRoute('/_abas/habitos')({ validateSearch: lerBuscaDeHabitos, component: Habitos });

function Habitos() {
  const { habito, novo } = Route.useSearch();
  const navegar = Route.useNavigate();
  // O formulário já abriu: tira o `novo` da URL para recarregar não abrir de novo.
  useEffect(() => {
    if (novo) void navegar({ search: habito ? { habito } : {}, replace: true });
  }, [novo, habito, navegar]);
  return (
    <HabitosScreen
      aberto={habito}
      abrirNovo={novo}
      onAbrir={(id) => void navegar({ search: id ? { habito: id } : {} })}
      onVerMeta={(meta) => void navegar({ to: '/metas', search: { meta } })}
    />
  );
}
