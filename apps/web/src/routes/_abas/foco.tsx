import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_abas/foco')({
  beforeLoad: () => {
    throw redirect({ to: '/casa', replace: true });
  },
});
