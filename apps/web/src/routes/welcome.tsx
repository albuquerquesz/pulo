import { createFileRoute } from '@tanstack/react-router';

import { Redirecionar, useApp } from '@/features/app';
import { WelcomeScreen } from '@/features/welcome/WelcomeScreen';

export const Route = createFileRoute('/welcome')({ component: Welcome });

/** Com os dados prontos da conta, segue para o app. */
function Welcome() {
  const { fase } = useApp();
  if (fase === 'pronto') return <Redirecionar para="/" />;
  return <WelcomeScreen />;
}
