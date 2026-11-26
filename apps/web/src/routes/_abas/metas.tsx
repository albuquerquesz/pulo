import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

import { lerBuscaDeMetas } from '@/features/metas/logic';
import { MetasScreen } from '@/features/metas/MetasScreen';

export const Route = createFileRoute('/_abas/metas')({ validateSearch: lerBuscaDeMetas, component: Metas });

function Metas() {
  const { meta, nova } = Route.useSearch();
  const navegar = useNavigate();
  // O formulário já abriu: tira o `nova` da URL para recarregar não abrir de novo.
  useEffect(() => {
    if (nova) void navegar({ to: '/metas', search: meta ? { meta } : {}, replace: true });
  }, [nova, meta, navegar]);
  return <MetasScreen metaAberta={meta} abrirNova={nova} />;
}
