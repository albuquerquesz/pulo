import { Navigate, createFileRoute } from '@tanstack/react-router';

import { useApp } from '@/features/app';
import { WelcomeScreen } from '@/features/welcome/WelcomeScreen';

export const Route = createFileRoute('/welcome')({ component: Welcome });

/** Com os dados prontos (conta ou demo), segue para o app. */
function Welcome() {
  const { fase } = useApp();
  if (fase === 'pronto') return <Navigate to="/" replace />;
  return <WelcomeScreen />;
}
