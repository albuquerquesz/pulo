import { createFileRoute } from '@tanstack/react-router';

import { EmBreve } from '@/features/casca/EmBreve';

export const Route = createFileRoute('/_abas/habitos')({
  component: () => <EmBreve titulo="Hábitos" texto="A página dos seus hábitos chega em breve." />,
});
