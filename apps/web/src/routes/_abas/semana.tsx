import { createFileRoute } from '@tanstack/react-router';

import { SemanaScreen } from '@/features/semana/SemanaScreen';

export const Route = createFileRoute('/_abas/semana')({ component: SemanaScreen });
