import { createFileRoute } from '@tanstack/react-router';

import { lerBuscaDeMetas } from '@/features/metas/logic';
import { MetasScreen } from '@/features/metas/MetasScreen';

export const Route = createFileRoute('/_abas/metas')({ validateSearch: lerBuscaDeMetas, component: Metas });

function Metas() {
  const { meta } = Route.useSearch();
  return <MetasScreen metaAberta={meta} />;
}
