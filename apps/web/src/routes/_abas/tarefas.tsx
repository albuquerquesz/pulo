import { createFileRoute } from '@tanstack/react-router';

import { EmBreve } from '@/features/casca/EmBreve';

export const Route = createFileRoute('/_abas/tarefas')({
  component: () => <EmBreve titulo="Tarefas" texto="Seu quadro de tarefas chega em breve." />,
});
