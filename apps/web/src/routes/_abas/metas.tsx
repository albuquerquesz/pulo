import { createFileRoute } from '@tanstack/react-router';

import { MetasScreen } from '@/features/metas/MetasScreen';

export const Route = createFileRoute('/_abas/metas')({ component: MetasScreen });
