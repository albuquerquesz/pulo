import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_abas/semana')({
  beforeLoad: () => {
    throw redirect({ to: '/', replace: true });
  },
});
