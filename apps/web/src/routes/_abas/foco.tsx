import { createFileRoute } from '@tanstack/react-router';

import { FocoScreen } from '@/features/foco/FocoScreen';

export const Route = createFileRoute('/_abas/foco')({ component: FocoScreen });
