import { createFileRoute } from '@tanstack/react-router';

import { TarefasScreen } from '@/features/tarefas/TarefasScreen';

export const Route = createFileRoute('/_abas/tarefas')({ component: TarefasScreen });
